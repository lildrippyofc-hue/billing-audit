import os
import secrets
import hashlib
import sqlite3
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Any, Dict

import requests as req_lib
from requests import Session as ReqSession

from fastapi import FastAPI, HTTPException, Cookie, Response, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Paths & DB ────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent

# On Railway set DATA_DIR to your mounted volume path so data survives deploys.
# Locally it defaults to the project folder (same as before).
DATA_DIR = Path(os.environ.get("DATA_DIR", str(BASE_DIR)))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "audit.db"
EXPORTS_DIR = DATA_DIR / "shift_exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Auth config ───────────────────────────────────────────────────────────────

def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

# To change the password set the APP_PASSWORD environment variable on Railway.
# Default password for local dev only — override it in production!
_APP_PASSWORD = os.environ.get("APP_PASSWORD", "N3747P9R")

# Three-tier access system:
# james → full access
# work  → truck/billing tabs only
# guest → read-only access
_USERS: Dict[str, str] = {
    "james":   _hash(_APP_PASSWORD),
    "aldioks": _hash(_APP_PASSWORD),
    "dean":    _hash(_APP_PASSWORD),
    "work":    _hash(os.environ.get("WORK_PASSWORD", "work1")),
    "guest":   _hash(os.environ.get("GUEST_PASSWORD", "guest1")),
}

# Role lookup
_ROLES: Dict[str, str] = {
    "james":   "admin",
    "aldioks": "admin",
    "dean":    "admin",
    "work":    "work",
    "guest":   "guest",
}

# In-memory session store (fine for a single-process server)
_sessions: Dict[str, str] = {}

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(title="Billing Audit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS reports (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT    NOT NULL,
            uploaded_at TEXT    NOT NULL,
            row_count   INTEGER NOT NULL DEFAULT 0,
            headers     TEXT    NOT NULL,
            rows        TEXT    NOT NULL,
            selectors   TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_decisions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            truck_key    TEXT    NOT NULL,
            decision     TEXT    NOT NULL,
            report_id    INTEGER,
            po_keys      TEXT    DEFAULT '[]',
            supplier_key TEXT,
            decided_at   TEXT    NOT NULL,
            UNIQUE(truck_key),
            FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS visits (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            username   TEXT    NOT NULL,
            visited_at TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS vendor_unload_times (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor      TEXT    NOT NULL,
            dock_min    INTEGER NOT NULL,
            shift_date  TEXT    NOT NULL,
            source      TEXT    NOT NULL DEFAULT 'Manual',
            truck_ref   TEXT,
            recorded_at TEXT    NOT NULL
        );
    """)
    conn.commit()
    conn.close()


init_db()


# ── Pydantic models ───────────────────────────────────────────────────────────

class ReportIn(BaseModel):
    filename: str
    headers: List[str]
    rows: List[Dict[str, Any]]
    selectors: Dict[str, str]


class DecisionIn(BaseModel):
    truck_key: str
    decision: str
    report_id: Optional[int] = None
    po_keys: Optional[List[str]] = []
    supplier_key: Optional[str] = None


class LoginIn(BaseModel):
    username: str
    password: str


_dms_session_cache: Dict[str, Any] = {}


def _load_dms_config() -> Dict[str, Any]:
    cfg_path = BASE_DIR / "dms_config.json"
    cfg: Dict[str, Any] = {}
    parse_error: str = ""
    if cfg_path.exists():
        try:
            raw = cfg_path.read_text(encoding="utf-8-sig")  # utf-8-sig strips BOM if present
            cfg = json.loads(raw)
        except Exception as e:
            parse_error = str(e)
            cfg = {}
    username = os.environ.get("DMS_USERNAME") or cfg.get("username") or ""
    password = os.environ.get("DMS_PASSWORD") or cfg.get("password") or ""
    base = (os.environ.get("DMS_BASE_URL") or cfg.get("base_url") or "https://dms.eclipseia.com").rstrip("/")
    # The DMS API is served on 443; :5055 is dead and only causes connect timeouts.
    base = base.replace(":5055", "")
    return {
        "username": username,
        "password": password,
        "base_url": base,
        "location_code": os.environ.get("DMS_LOCATION_CODE") or cfg.get("location_code") or "OLA",
        "location_name": os.environ.get("DMS_LOCATION_NAME") or cfg.get("location_name") or "ALDIOKS",
        "timeout": int(os.environ.get("DMS_TIMEOUT_SECONDS") or cfg.get("timeout_seconds") or 25),
        "_parse_error": parse_error,
        "_cfg_path": str(cfg_path),
    }


_EDGE_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
}


def _dms_post(path: str, payload: Dict[str, Any], config: Dict[str, Any]) -> Any:
    url = f"{config['base_url']}/{path.lstrip('/')}"
    session = config.get("_session") or req_lib
    try:
        resp = session.post(url, json=payload, headers=_EDGE_HEADERS, timeout=config["timeout"])
        if not resp.ok:
            raise HTTPException(status_code=502, detail=f"DMS returned {resp.status_code}: {resp.text[:500]}")
        return resp.json() if resp.text.strip() else {}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach DMS: {exc}")


def _dms_json_request(path: str, payload: Dict[str, Any], config: Dict[str, Any]) -> Any:
    return _dms_post(path, payload, config)


def _dms_login_payloads(username: str, password: str) -> List[Dict[str, Any]]:
    return [
        {"un": username, "pw": password},
        {"username": username, "password": password},
        {"user": username, "password": password},
    ]


def _first_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        # NOTE: DMS api/stamp/getStamps wraps the rows under "list".
        for key in ("list", "data", "rows", "loads", "stamps", "result", "results", "Table"):
            found = _first_list(value.get(key))
            if found:
                return found
    return []


def _find_dms_locations(login_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    candidates = []
    for key in ("locations", "locs", "location", "loc"):
        value = login_data.get(key)
        if isinstance(value, list):
            candidates.extend([x for x in value if isinstance(x, dict)])
        elif isinstance(value, dict):
            candidates.append(value)
    userinfo = login_data.get("userinfo")
    if isinstance(userinfo, dict):
        for key in ("locations", "locs", "location", "loc"):
            value = userinfo.get(key)
            if isinstance(value, list):
                candidates.extend([x for x in value if isinstance(x, dict)])
            elif isinstance(value, dict):
                candidates.append(value)
    return candidates


def _select_dms_location(locations: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
    code = str(config["location_code"]).upper()
    name = str(config["location_name"]).upper()
    for loc in locations:
        text = " ".join(str(loc.get(k, "")) for k in ("cCode", "code", "name", "locName", "location", "locid")).upper()
        if code and code in text:
            return loc
    for loc in locations:
        text = " ".join(str(v) for v in loc.values()).upper()
        if name and name in text:
            return loc
    if locations:
        return locations[0]
    raise HTTPException(status_code=502, detail="DMS login worked, but no DMS location was returned.")


def _ensure_dms_session(force: bool = False) -> Dict[str, Any]:
    config = _load_dms_config()
    if (
        not force
        and _dms_session_cache.get("userinfo")
        and _dms_session_cache.get("loc")
        and _dms_session_cache.get("base_url") == config["base_url"]
    ):
        return _dms_session_cache

    username = str(config["username"]).strip()
    password = str(config["password"]).strip()
    if not username or not password or "YOUR_" in username or "YOUR_" in password:
        parse_err = config.get("_parse_error", "")
        cfg_path  = config.get("_cfg_path", "dms_config.json")
        detail = (
            f"DMS credentials are not configured. "
            f"Config file: {cfg_path}. "
            + (f"JSON parse error: {parse_err}. " if parse_err else "File parsed OK but username/password missing. ")
            + "Fill in username and password in dms_config.json."
        )
        raise HTTPException(status_code=400, detail=detail)

    # Use a requests Session so cookies persist across the login + data calls
    dms_session = ReqSession()
    dms_session.headers.update(_EDGE_HEADERS)
    config["_session"] = dms_session

    # Seed cookies by loading the login page first
    try:
        dms_session.get(f"{config['base_url']}/login", timeout=config["timeout"])
    except Exception:
        pass

    last_error = None
    login_data: Dict[str, Any] = {}
    for payload in _dms_login_payloads(username, password):
        try:
            response = _dms_post("api/login/trylogin", payload, config)
            ui = response.get("userinfo") or {}
            if isinstance(response, dict) and ui.get("login"):
                login_data = response
                break
        except HTTPException as exc:
            last_error = exc
    if not login_data:
        if last_error:
            raise last_error
        raise HTTPException(status_code=502, detail="DMS login did not return session data. Credentials may be wrong.")

    # DMS returns selLoc directly on login — use it if present
    sel_loc = login_data.get("selLoc")
    if isinstance(sel_loc, dict) and sel_loc:
        loc = sel_loc
    else:
        locations = _find_dms_locations(login_data)
        if not locations:
            try:
                loc_response = _dms_json_request("api/location/getLocations", {"userinfo": login_data.get("userinfo") or login_data}, config)
                locations = [x for x in _first_list(loc_response) if isinstance(x, dict)]
            except HTTPException:
                locations = []
        loc = _select_dms_location(locations, config) if locations else sel_loc or {}

    session = {
        "base_url": config["base_url"],
        "userinfo": login_data.get("userinfo") or login_data.get("user") or login_data,
        "buck": login_data.get("buck") or login_data.get("bucket") or {},
        "loc": loc,
        "sel_loc": sel_loc or loc,
        "appts": login_data.get("appts") or [],
        "sel_appt": login_data.get("selAppt") or "",
        "config": config,
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }
    _dms_session_cache.clear()
    _dms_session_cache.update(session)
    return session


def _dms_business_date(date_text: Optional[str]) -> str:
    if date_text:
        try:
            dt = datetime.strptime(date_text, "%Y-%m-%d")
        except ValueError:
            try:
                dt = datetime.strptime(date_text, "%m/%d/%Y")
            except ValueError:
                dt = datetime.now()
    else:
        dt = datetime.now()
    return f"{dt.month}/{dt.day}/{dt.year}"


def _parse_dms_time(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if not text:
        return None
    # DMS stamp times look like "06/13/2026 03:46 AM UTC" (always UTC).
    # Strip a trailing UTC/GMT marker so the AM/PM formats below match; the
    # value is UTC either way and we tag it as such.
    text = text.replace("+00:00", "Z")
    low = text.lower()
    for suffix in (" utc", " gmt"):
        if low.endswith(suffix):
            text = text[: -len(suffix)].strip()
            break
    formats = [
        "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S",
        "%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y %I:%M %p", "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M", "%Y-%m-%d %H:%M:%S",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(text, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            pass
    return text


def _dms_key(row: Dict[str, Any]) -> str:
    for key in ("rowid", "loadrowid", "ldrowid", "id", "loadid"):
        value = row.get(key)
        if value not in (None, ""):
            return f"id:{value}"
    for key in ("poNum", "po", "ponum", "trkNum", "trknum", "truck", "ref"):
        value = row.get(key)
        if value not in (None, ""):
            return f"{key}:{value}"
    return ""


def _normalize_portal_truck(load: Dict[str, Any], stamp: Dict[str, Any]) -> Dict[str, Any]:
    # Merge load (truck info: qty/desc/notes) with stamp (the timestamps), joined
    # by rowid. DMS field names confirmed from a live shift:
    #   drchk = driver check-in, drdoor = driver at door, clrkchk = clerk check-in,
    #   unstart = unload start, unfin = unload finish, recstart = receiving start,
    #   recfin = receiving finish, drleft = driver left, drstat = status.
    merged = {**load, **stamp}
    appointment = _parse_dms_time(
        merged.get("appt") or merged.get("apptDisplay") or merged.get("appointment") or merged.get("appointmentTime")
    )
    # Real driver/clerk check-in only — do NOT fall back to the appointment, or
    # every scheduled-but-not-arrived truck would look "checked in".
    check_in = _parse_dms_time(
        merged.get("drchk") or merged.get("driverCheckIn") or merged.get("driver_check_in") or merged.get("clrkchk")
    )
    driver_at_door = _parse_dms_time(
        merged.get("drdoor") or merged.get("driverAtDoor") or merged.get("driver_at_door")
    )
    unload_start = _parse_dms_time(
        merged.get("unstart") or merged.get("unloadStart") or merged.get("unload_start")
    )
    unload_finish = _parse_dms_time(
        merged.get("unfin") or merged.get("unloadFinish") or merged.get("unload_finish")
    )
    receiving_start = _parse_dms_time(
        merged.get("recstart") or merged.get("receivingStart") or merged.get("receiving_start")
    )
    receiving_finish = _parse_dms_time(
        merged.get("recfin") or merged.get("receivingFinish") or merged.get("receiving_finish")
    )
    driver_left = _parse_dms_time(merged.get("drleft") or merged.get("driverLeft"))
    ref = (
        merged.get("trkNum") or merged.get("trk") or merged.get("truck")
        or merged.get("cabNum") or merged.get("rowid") or merged.get("poNum") or ""
    )
    return {
        "id": f"dms-{_dms_key(merged) or ref}",
        "source": "DMS",
        "rowid": merged.get("rowid"),
        "ref": str(ref or "").strip(),
        "door": str(merged.get("doorNum") or merged.get("door") or "").strip(),
        "supplier": str(merged.get("sup") or merged.get("supplier") or merged.get("vendor") or "").strip(),
        "carrier": str(merged.get("trnum") or merged.get("carr") or "").strip(),
        "po": str(merged.get("poNum") or merged.get("po") or "").strip(),
        "area": str(merged.get("area") or "").strip(),
        "comments": str(merged.get("comments") or merged.get("notes") or "").strip(),
        "appointmentIso": appointment,
        "checkInIso": check_in,
        "driverAtDoorIso": driver_at_door,
        "unloadStartIso": unload_start,
        "unloadFinishIso": unload_finish,
        "receivingStartIso": receiving_start,
        "receivingFinishIso": receiving_finish,
        "driverLeftIso": driver_left,
        "finishIso": receiving_finish,
        "statusText": str(merged.get("drstat") or "").strip(),
    }


def _merge_dms_portal_rows(loads: List[Dict[str, Any]], stamps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    stamps_by_key: Dict[str, Dict[str, Any]] = {}
    for stamp in stamps:
        key = _dms_key(stamp)
        if key:
            stamps_by_key[key] = stamp
    seen = set()
    trucks = []
    # Only show trucks that have actually arrived — i.e. have a driver/clerk
    # check-in stamp. Scheduled-but-not-checked-in loads (door/PO/appt only)
    # are dropped so the board reflects trucks physically on site.
    for load in loads:
        key = _dms_key(load)
        stamp = stamps_by_key.get(key, {})
        truck = _normalize_portal_truck(load, stamp)
        if truck["checkInIso"]:
            trucks.append(truck)
            if key:
                seen.add(key)
    for stamp in stamps:
        key = _dms_key(stamp)
        if key and key in seen:
            continue
        truck = _normalize_portal_truck({}, stamp)
        if truck["checkInIso"]:
            trucks.append(truck)
    return trucks


# ── Auth helpers ──────────────────────────────────────────────────────────────

def require_auth(session: Optional[str] = Cookie(default=None)) -> str:
    if not session or session not in _sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return _sessions[session]


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.post("/api/login")
def login(creds: LoginIn, response: Response):
    pw_hash = _hash(creds.password)
    stored  = _USERS.get(creds.username.strip().lower())
    if stored is None or stored != pw_hash:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = secrets.token_hex(32)
    uname = creds.username.strip().lower()
    _sessions[token] = uname
    response.set_cookie(
        "session", token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,   # 7 days
        secure=os.environ.get("RAILWAY_ENVIRONMENT") is not None,
    )
    # Record visit for daily counter
    try:
        conn = get_db()
        now = datetime.now(timezone.utc).isoformat()
        conn.execute("INSERT INTO visits (username, visited_at) VALUES (?, ?)", (uname, now))
        conn.commit()
        conn.close()
    except Exception:
        pass
    return {"ok": True, "username": uname, "role": _ROLES.get(uname, "guest")}


@app.post("/api/logout")
def logout(response: Response, session: Optional[str] = Cookie(default=None)):
    if session and session in _sessions:
        del _sessions[session]
    response.delete_cookie("session")
    return {"ok": True}


@app.get("/api/me")
def me(username: str = Depends(require_auth)):
    return {"username": username, "role": _ROLES.get(username, "guest")}


@app.get("/api/daily-visitors")
def daily_visitors(username: str = Depends(require_auth)):
    """Return count of logins in the last 24 hours."""
    try:
        conn = get_db()
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM visits WHERE visited_at >= ?", (cutoff,)
        ).fetchone()
        conn.close()
        return {"count": row["cnt"] if row else 0}
    except Exception:
        return {"count": 0}


# ── Reports ───────────────────────────────────────────────────────────────────

@app.post("/api/reports", status_code=201)
def create_report(report: ReportIn, _: str = Depends(require_auth)):
    conn = get_db()
    try:
        cur = conn.execute(
            """INSERT INTO reports (filename, uploaded_at, row_count, headers, rows, selectors)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                report.filename,
                datetime.now(timezone.utc).isoformat(),
                len(report.rows),
                json.dumps(report.headers),
                json.dumps(report.rows),
                json.dumps(report.selectors),
            ),
        )
        rid = cur.lastrowid
        conn.commit()
    finally:
        conn.close()
    return {"id": rid, "filename": report.filename, "row_count": len(report.rows)}


@app.get("/api/reports")
def list_reports(_: str = Depends(require_auth)):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, filename, uploaded_at, row_count FROM reports ORDER BY uploaded_at DESC"
        ).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


@app.get("/api/reports/{report_id}")
def get_report(report_id: int, _: str = Depends(require_auth)):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "id":          row["id"],
        "filename":    row["filename"],
        "uploaded_at": row["uploaded_at"],
        "row_count":   row["row_count"],
        "headers":     json.loads(row["headers"]),
        "rows":        json.loads(row["rows"]),
        "selectors":   json.loads(row["selectors"]),
    }


@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int, _: str = Depends(require_auth)):
    conn = get_db()
    try:
        conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


# ── Audit decisions ───────────────────────────────────────────────────────────

@app.get("/api/decisions")
def list_decisions(report_id: Optional[int] = None, _: str = Depends(require_auth)):
    conn = get_db()
    try:
        if report_id is not None:
            rows = conn.execute(
                "SELECT * FROM audit_decisions WHERE report_id = ? ORDER BY decided_at DESC",
                (report_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM audit_decisions ORDER BY decided_at DESC"
            ).fetchall()
    finally:
        conn.close()
    return [
        {**dict(r), "po_keys": json.loads(r["po_keys"] or "[]")}
        for r in rows
    ]


@app.post("/api/decisions")
def save_decision(d: DecisionIn, _: str = Depends(require_auth)):
    conn = get_db()
    try:
        conn.execute(
            """
            INSERT INTO audit_decisions
                (truck_key, decision, report_id, po_keys, supplier_key, decided_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(truck_key) DO UPDATE SET
                decision     = excluded.decision,
                report_id    = excluded.report_id,
                po_keys      = excluded.po_keys,
                supplier_key = excluded.supplier_key,
                decided_at   = excluded.decided_at
            """,
            (
                d.truck_key,
                d.decision,
                d.report_id,
                json.dumps(d.po_keys or []),
                d.supplier_key,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


@app.delete("/api/decisions")
def delete_decision(truck_key: str, _: str = Depends(require_auth)):
    conn = get_db()
    try:
        conn.execute("DELETE FROM audit_decisions WHERE truck_key = ?", (truck_key,))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}




# ── Frontend ──────────────────────────────────────────────────────────────────


@app.get("/api/dms/session")
def dms_session_status():
    session = _ensure_dms_session()
    loc = session.get("loc") or {}
    return {
        "ok": True,
        "location": {
            "locid": loc.get("locid"),
            "name": loc.get("name") or loc.get("locName") or loc.get("location"),
            "cCode": loc.get("cCode") or loc.get("code"),
        },
        "cached_at": session.get("cached_at"),
    }


@app.get("/api/dms/portal")
def dms_portal(date: Optional[str] = None, force: bool = False, debug: bool = False):
    """Read DMS load/stamp rows for My Portal. This route never writes to DMS."""
    # In debug mode, never 500 — capture and return whatever we can learn.
    if debug:
        dbg: Dict[str, Any] = {}
        try:
            session = _ensure_dms_session(force=force)
        except Exception as e:
            return {"ok": False, "debug": {"stage": "login", "error": str(e)}}
        info = _dms_business_date(date)
        base_payload = {
            "info": info, "loc": session["loc"],
            "userinfo": session["userinfo"], "buck": session.get("buck") or {},
        }
        dbg["business_date"] = info
        dbg["location"] = session["loc"]
        try:
            loads_response = _dms_json_request("api/load/getloaddetails", base_payload, session["config"])
            loads = [x for x in _first_list(loads_response) if isinstance(x, dict)]
        except Exception as e:
            loads, dbg["loads_error"] = [], str(e)
        try:
            stamps_response = _dms_json_request("api/stamp/getStamps", base_payload, session["config"])
            stamps = [x for x in _first_list(stamps_response) if isinstance(x, dict)]
        except Exception as e:
            stamps, dbg["stamps_error"] = [], str(e)
        trucks = _merge_dms_portal_rows(loads, stamps)
        dbg.update({
            "load_count": len(loads),
            "stamp_count": len(stamps),
            "load_keys": sorted(loads[0].keys()) if loads else [],
            "stamp_keys": sorted(stamps[0].keys()) if stamps else [],
            "sample_load": loads[0] if loads else None,
            "sample_stamp": stamps[0] if stamps else None,
            "first_truck_normalized": trucks[0] if trucks else None,
            "truck_count": len(trucks),
        })
        return {"ok": True, "debug": dbg}

    session = _ensure_dms_session(force=force)
    info = _dms_business_date(date)
    base_payload = {
        "info": info,
        "loc": session["loc"],
        "userinfo": session["userinfo"],
        "buck": session.get("buck") or {},
    }
    loads_response = _dms_json_request("api/load/getloaddetails", base_payload, session["config"])
    stamps_response = _dms_json_request("api/stamp/getStamps", base_payload, session["config"])
    loads = [x for x in _first_list(loads_response) if isinstance(x, dict)]
    stamps = [x for x in _first_list(stamps_response) if isinstance(x, dict)]
    trucks = _merge_dms_portal_rows(loads, stamps)
    return {
        "ok": True,
        "business_date": info,
        "location": session["loc"],
        "load_count": len(loads),
        "stamp_count": len(stamps),
        "trucks": trucks,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

class DmsStampIn(BaseModel):
    load_id: Optional[str] = None
    po: Optional[str] = None
    stamp_type: str
    stamp_time: Optional[str] = None

STAMP_TYPE_MAP = {
    "checkin":          "checkIn",
    "check_in":         "checkIn",
    "driveratdoor":     "driverAtDoor",
    "driver_at_door":   "driverAtDoor",
    "unloadstart":      "unloadStart",
    "unload_start":     "unloadStart",
    "unloadfinish":     "unloadFinish",
    "unload_finish":    "unloadFinish",
    "receivingfinish":  "receivingFinish",
    "receiving_finish": "receivingFinish",
}

@app.post("/api/dms/stamp")
def dms_stamp(body: DmsStampIn):
    session = _ensure_dms_session()
    stamp_key = STAMP_TYPE_MAP.get(body.stamp_type.lower().replace(" ", ""), body.stamp_type)
    stamp_time = body.stamp_time or datetime.now(timezone.utc).isoformat()
    payload = {
        "loc":      session["loc"],
        "userinfo": session["userinfo"],
        "buck":     session.get("buck") or {},
        "stampType": stamp_key,
        "stampTime": stamp_time,
    }
    if body.load_id:
        payload["loadId"] = body.load_id
    if body.po:
        payload["po"] = body.po
    candidates = [
        "api/stamp/saveStamp",
        "api/stamp/addStamp",
        "api/stamp/createStamp",
        "api/stamp/stampLoad",
    ]
    last_err = None
    for path in candidates:
        try:
            result = _dms_json_request(path, payload, session["config"])
            ok_flag = True
            if isinstance(result, dict):
                ok_flag = result.get("ok") or result.get("success") or result.get("result") or not result.get("error")
            return {"ok": bool(ok_flag), "endpoint": path, "stamp_type": stamp_key, "stamp_time": stamp_time, "response": result}
        except Exception as e:
            last_err = str(e)
    raise HTTPException(status_code=502, detail=f"DMS stamp failed on all known endpoints. Last error: {last_err}. Open DMS in Chrome DevTools (Network tab), stamp a truck manually, and note the POST URL — then set stamp_endpoint in dms_config.json.")

class ShiftExportIn(BaseModel):
    shift_date: str
    filename: str
    truck_count: int
    csv: str
    trucks: List[Dict[str, Any]] = []

@app.post("/api/portal/export", status_code=201)
def save_shift_export(body: ShiftExportIn):
    safe_name = "".join(c for c in body.filename if c.isalnum() or c in "-_.")
    if not safe_name.endswith(".csv"):
        safe_name += ".csv"
    csv_path = EXPORTS_DIR / safe_name
    csv_path.write_text(body.csv, encoding="utf-8")
    meta_path = EXPORTS_DIR / (safe_name[:-4] + ".json")
    meta_path.write_text(json.dumps({
        "shift_date": body.shift_date,
        "filename": safe_name,
        "truck_count": body.truck_count,
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "trucks": body.trucks,
    }, indent=2), encoding="utf-8")
    return {"ok": True, "filename": safe_name}

@app.get("/api/portal/exports")
def list_shift_exports():
    exports = []
    for meta_file in sorted(EXPORTS_DIR.glob("*.json"), reverse=True):
        try:
            data = json.loads(meta_file.read_text(encoding="utf-8"))
            exports.append({
                "shift_date": data.get("shift_date", ""),
                "filename": data.get("filename", ""),
                "truck_count": data.get("truck_count", 0),
                "saved_at": data.get("saved_at", ""),
            })
        except Exception:
            pass
    return {"ok": True, "exports": exports}

@app.get("/api/portal/exports/{filename}")
def download_shift_export(filename: str):
    safe_name = "".join(c for c in filename if c.isalnum() or c in "-_.")
    csv_path = EXPORTS_DIR / safe_name
    if not csv_path.exists() or csv_path.suffix != ".csv":
        raise HTTPException(status_code=404, detail="Export not found.")
    return FileResponse(str(csv_path), media_type="text/csv", filename=safe_name)

class VendorLearnTruck(BaseModel):
    supplier: Optional[str] = None
    dock_min: Optional[int] = None
    shift_date: Optional[str] = None
    source: Optional[str] = "Manual"
    ref: Optional[str] = None

class VendorLearnIn(BaseModel):
    trucks: List[VendorLearnTruck] = []

@app.post("/api/portal/learn", status_code=201)
def portal_learn(body: VendorLearnIn):
    if not body.trucks:
        return {"ok": True, "inserted": 0}
    conn = get_db()
    now_str = datetime.now(timezone.utc).isoformat()
    inserted = 0
    for t in body.trucks:
        vendor = (t.supplier or "").strip().upper()
        if not vendor or t.dock_min is None or t.dock_min <= 0:
            continue
        if t.dock_min > 720:
            continue  # ignore implausible values (>12 hrs)
        conn.execute(
            "INSERT INTO vendor_unload_times (vendor, dock_min, shift_date, source, truck_ref, recorded_at) VALUES (?,?,?,?,?,?)",
            (vendor, t.dock_min, t.shift_date or "", t.source or "Manual", t.ref or "", now_str)
        )
        inserted += 1
    conn.commit()
    conn.close()
    return {"ok": True, "inserted": inserted}

@app.get("/api/portal/vendor-stats")
def portal_vendor_stats():
    conn = get_db()
    rows = conn.execute("""
        SELECT vendor, dock_min, recorded_at
        FROM vendor_unload_times
        WHERE dock_min > 0 AND dock_min <= 720
        ORDER BY vendor, recorded_at DESC
    """).fetchall()
    conn.close()
    from collections import defaultdict
    by_vendor = defaultdict(list)
    for r in rows:
        by_vendor[r[0]].append(r[1])
    latest_seen = {}
    for r in rows:
        if r[0] not in latest_seen:
            latest_seen[r[0]] = r[2]
    stats = []
    for vendor, mins in sorted(by_vendor.items()):
        mins_sorted = sorted(mins)
        n = len(mins_sorted)
        avg = round(sum(mins_sorted) / n)
        p75 = mins_sorted[int(n * 0.75)]
        stats.append({
            "vendor": vendor,
            "avg_min": avg,
            "p75_min": p75,
            "min_min": mins_sorted[0],
            "max_min": mins_sorted[-1],
            "count": n,
            "last_seen": latest_seen.get(vendor, ""),
        })
    return {"ok": True, "stats": stats}

@app.get("/")
def serve_app():
    return FileResponse(str(BASE_DIR / "index.html"))
