import os
import secrets
import hashlib
import sqlite3
import json
import gzip
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from html import unescape
from pathlib import Path
from typing import Optional, List, Any, Dict

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

# ── Auth config ───────────────────────────────────────────────────────────────

def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

# To change the password set the APP_PASSWORD environment variable on Railway.
# Default password for local dev only — override it in production!
_APP_PASSWORD = os.environ.get("APP_PASSWORD", "N3747P9R")

# Three-tier access system:
# james → full access
# work  → truck/billing tabs only
# guest → break time / news / games only
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


# ── News feed ─────────────────────────────────────────────────────────────────

_news_cache: Dict[str, Any] = {"data": None, "fetched_at": None}
NEWS_TTL = timedelta(minutes=15)

NEWS_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip",
}

NEWS_FEEDS = {
    "cnn": {
        "source": "CNN",
        "url": "http://rss.cnn.com/rss/cnn_topstories.rss",
        "limit": 12,
    },
    "cnn_election": {
        "source": "CNN",
        "url": "http://rss.cnn.com/rss/cnn_allpolitics.rss",
        "limit": 10,
    },
    "fox": {
        "source": "Fox News",
        "url": "https://moxie.foxnews.com/google-publisher/latest.xml",
        "limit": 12,
    },
    "fox_election": {
        "source": "Fox News",
        "url": "https://moxie.foxnews.com/google-publisher/politics.xml",
        "limit": 10,
    },
}

REALCLEAR_LATEST_POLLS_URL = "https://www.realclearpolling.com/latest-polls"


def fetch_url_bytes(url: str, timeout: int = 12) -> bytes:
    req = urllib.request.Request(url, headers=NEWS_HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
        encoding = (resp.headers.get("Content-Encoding") or "").lower()
        if encoding == "gzip" or data[:2] == b"\x1f\x8b":
            data = gzip.decompress(data)
        return data


def strip_html(value: str) -> str:
    value = re.sub(r"<!--.*?-->", " ", value or "", flags=re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    value = unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def parse_rss_feed(feed: Dict[str, Any]) -> List[Dict[str, str]]:
    xml_bytes = fetch_url_bytes(feed["url"])
    root = ET.fromstring(xml_bytes)
    channel = root.find("channel") or root
    media_ns = "http://search.yahoo.com/mrss/"
    articles = []

    for item in list(channel.findall("item"))[: int(feed.get("limit", 12))]:
        title = strip_html(item.findtext("title", ""))
        link = (item.findtext("link", "") or "").strip()
        desc = strip_html(item.findtext("description", ""))
        pub = (item.findtext("pubDate", "") or "").strip()
        image = ""

        for tag in [f"{{{media_ns}}}content", f"{{{media_ns}}}thumbnail"]:
            el = item.find(tag)
            if el is not None:
                image = el.get("url", "")
                if image:
                    break
        if not image:
            enc = item.find("enclosure")
            if enc is not None:
                image = enc.get("url", "")

        if title:
            articles.append({
                "source": feed["source"],
                "title": title,
                "link": link,
                "description": desc,
                "pub_date": pub,
                "image": image,
            })

    return articles


def parse_realclear_latest_polls(limit: int = 80) -> List[Dict[str, Any]]:
    html = fetch_url_bytes(REALCLEAR_LATEST_POLLS_URL, timeout=15).decode("utf-8", "replace")
    polls: List[Dict[str, Any]] = []
    current_date = ""

    for row_match in re.finditer(r"<tr\b([^>]*)>(.*?)</tr>", html, flags=re.S | re.I):
        attrs = row_match.group(1)
        row = row_match.group(2)

        if "colSpan" in row or "colspan" in row:
            label = strip_html(row)
            if label:
                current_date = label
            continue

        if "data-id=" not in attrs:
            continue

        first_link = re.search(r'href="([^"]+)"[^>]*>\s*<span>(.*?)</span>', row, flags=re.S | re.I)
        if not first_link:
            continue

        race_path = first_link.group(1)
        race = strip_html(first_link.group(2))
        if race_path.startswith("/"):
            race_link = "https://www.realclearpolling.com" + race_path
        else:
            race_link = race_path

        anchors = re.findall(r'<a\b[^>]*href="([^"]*)"[^>]*>\s*<span>(.*?)</span>\s*</a>', row, flags=re.S | re.I)
        pollster = strip_html(anchors[1][1]) if len(anchors) > 1 else ""

        results = []
        seen = set()
        for name, score in re.findall(
            r">([^<>&]{1,80})<!-- -->\s*<span[^>]*>\s*([0-9]+(?:\.[0-9]+)?)\s*</span>",
            row,
            flags=re.S | re.I,
        ):
            candidate = strip_html(name)
            if not candidate:
                continue
            key = candidate.lower()
            if key in seen:
                continue
            seen.add(key)
            results.append({"candidate": candidate, "value": float(score)})

        spread_text = ""
        spread_match = re.search(
            r">Spread</div>.*?<span[^>]*class=\"[^\"]*capitalize[^\"]*\"[^>]*>(.*?)</span>.*?"
            r"<span[^>]*class=\"[^\"]*bubble-text[^\"]*\"[^>]*>(.*?)</span>",
            row,
            flags=re.S | re.I,
        )
        if spread_match:
            spread_text = f"{strip_html(spread_match.group(1))} {strip_html(spread_match.group(2))}".strip()

        category_match = re.search(r"/polls/([^/]+)/", race_path)
        category = category_match.group(1).replace("-", " ").title() if category_match else "Election"

        if race and results:
            polls.append({
                "source": "RealClearPolling",
                "date": current_date,
                "race": race,
                "category": category,
                "pollster": pollster,
                "results": results,
                "spread": spread_text,
                "link": race_link,
            })

        if len(polls) >= limit:
            break

    return polls


def build_polling_averages(polls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for poll in polls:
        race = poll.get("race") or "Unknown race"
        entry = grouped.setdefault(race, {
            "race": race,
            "category": poll.get("category", "Election"),
            "source": "RealClearPolling",
            "poll_count": 0,
            "link": poll.get("link", ""),
            "candidates": {},
        })
        entry["poll_count"] += 1
        for result in poll.get("results", []):
            name = result.get("candidate", "")
            if not name:
                continue
            bucket = entry["candidates"].setdefault(name, [])
            bucket.append(float(result.get("value", 0)))

    averages = []
    for race, entry in grouped.items():
        candidates = []
        for name, values in entry["candidates"].items():
            if values:
                candidates.append({"candidate": name, "value": round(sum(values) / len(values), 1)})
        candidates.sort(key=lambda item: item["value"], reverse=True)
        averages.append({
            "race": race,
            "category": entry["category"],
            "source": entry["source"],
            "poll_count": entry["poll_count"],
            "link": entry["link"],
            "candidates": candidates,
        })

    averages.sort(key=lambda item: (item["category"], item["race"]))
    return averages


@app.get("/api/news-dashboard")
def get_news_dashboard():
    now = datetime.now(timezone.utc)
    if (
        _news_cache["data"] is not None
        and _news_cache["fetched_at"] is not None
        and now - _news_cache["fetched_at"] < NEWS_TTL
    ):
        return _news_cache["data"]

    errors: Dict[str, str] = {}

    def load_feed(key: str) -> List[Dict[str, str]]:
        try:
            return parse_rss_feed(NEWS_FEEDS[key])
        except Exception as exc:
            errors[key] = str(exc)
            return []

    cnn = load_feed("cnn")
    fox = load_feed("fox")
    election_articles = load_feed("cnn_election") + load_feed("fox_election")
    election_articles.sort(key=lambda article: article.get("pub_date", ""), reverse=True)

    polls: List[Dict[str, Any]] = []
    try:
        polls = parse_realclear_latest_polls()
    except Exception as exc:
        errors["polls"] = (
            "RealClearPolling could not be loaded from the app right now. "
            f"Open {REALCLEAR_LATEST_POLLS_URL} directly or try Refresh again. Detail: {exc}"
        )

    result = {
        "cnn": cnn,
        "fox": fox,
        "articles": cnn + fox,
        "election_articles": election_articles[:24],
        "polls": polls,
        "polling_averages": build_polling_averages(polls),
        "polls_url": REALCLEAR_LATEST_POLLS_URL,
        "errors": errors,
        "fetched_at": now.isoformat(),
    }
    _news_cache["data"] = result
    _news_cache["fetched_at"] = now
    return result


@app.get("/api/news")
def get_news():
    return get_news_dashboard()


# ── Games ─────────────────────────────────────────────────────────────────────

@app.get("/games/flappy")
def serve_flappy():
    return FileResponse(str(BASE_DIR / "flappy_bird.html"))


@app.get("/games/paper-plane")
def serve_paper_plane():
    return FileResponse(str(BASE_DIR / "paper_plane.html"))


@app.get("/games/jetpack")
def serve_jetpack():
    return FileResponse(str(BASE_DIR / "jetpack.html"))


@app.get("/games/warehouse-rush")
def serve_warehouse_rush():
    return FileResponse(str(BASE_DIR / "warehouse_rush.html"))


@app.get("/games/forklift")
def serve_forklift():
    return FileResponse(str(BASE_DIR / "forklift_puzzle.html"))


@app.get("/games/jetpack2")
def serve_jetpack2():
    return FileResponse(str(BASE_DIR / "jetpack2.html"))


@app.get("/games/truck-tycoon")
def serve_truck_tycoon():
    return FileResponse(str(BASE_DIR / "truck_tycoon.html"))


@app.get("/games/warehouse-life")
def serve_warehouse_life():
    return FileResponse(str(BASE_DIR / "warehouse_life.html"))


@app.get("/games/warehouse-sim")
def serve_warehouse_sim():
    return FileResponse(str(BASE_DIR / "warehouse_sim.html"))


# ── Frontend ──────────────────────────────────────────────────────────────────

@app.get("/")
def serve_app():
    return FileResponse(str(BASE_DIR / "index.html"))
