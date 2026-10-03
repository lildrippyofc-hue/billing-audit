"""Rebuild PORTAL_ZONE_MODEL in index.html from a DMS Ranged Report export (read-only).

The My Portal "Zones" view splits the dock into Freezer, Cooler / Fresh Meat / Produce, and
Dry / Slip Sheet / Floor Load. For each zone it needs:
  * how trucks arrive relative to their appointment and how long an unload takes (feeds the
    finish-time simulation, same idea as PORTAL_FINISH_MODEL), and
  * the usual share of the zone finished at each time of night, plus how today's gap to that
    usual pace turns into a finish time (feeds the green / yellow / red status and the estimate).

    py build_zone_model.py "C:\\path\\to\\ALDIOKS - <start> to <end>.xlsx" [--doors 6] [--keep-last]

The newest business date in the file is skipped unless you pass --keep-last (exports are
usually pulled before that night has finished). Paste the printed object over
PORTAL_ZONE_MODEL in index.html. Rerun every month or two.
The zone grouping below must match PORTAL_ZONE_GROUPS in index.html.

Minnesota has no Ranged Report export, so its model is built from saved read-only DMS pulls (one
JSON file per night holding the load and stamp lists):

    py build_zone_model.py --history <folder> --site MN [--doors N] [--hold-out 2026-09-11:2026-09-24]

`--hold-out FROM:TO` leaves those business dates out, to validate on them. The constant printed is
PORTAL_ZONE_MODEL for OKS and PORTAL_ZONE_MODEL_MN for Minnesota.
"""
import bisect
import glob
import json
import os
import re
import statistics as st
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Chicago")
MIN = 60000.0
STEP_MIN = 15
STEPS = 14 * 60 // STEP_MIN          # 7 PM through 9 AM
CHECKPOINTS = [240, 300, 360, 420, 480, 540]   # minutes after the 7 PM start: 11 PM .. 4 AM
ZONES = [
    ("freezer", ["frz", "freezer"]),
    ("chilled", ["chl", "chill", "cooler", "eggs", "egg", "fresh meat", "meat", "produce"]),
    ("dry", ["dry", "amb", "ambient", "slip sheet", "slip", "floor loaded", "floor load", "floor",
             "plant", "plants", "plants flowers", "cold plant", "cold plants", "plant load", "plant loads", "floral", "flowers"]),
]


def zone_of(area):
    text = re.sub(r"[^a-z0-9]+", " ", str(area or "").lower()).strip()
    for name, keys in ZONES:
        if text in keys:
            return name
    if re.search(r"\bplants?\b", text):        # any other plant area name still belongs to the dry zone
        return "dry"
    return None


def local_ms(value):
    if not value:
        return None
    text = str(value).strip()
    for fmt in ("%m/%d/%Y %I:%M %p", "%m/%d/%Y %H:%M"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=TZ).timestamp() * 1000
        except ValueError:
            pass
    return None


def percentiles(values):
    values = sorted(values)
    table = [round(values[min(len(values) - 1, int(len(values) * p / 100))]) for p in range(101)]
    table[0], table[100] = table[1], table[99]      # trim the single most extreme value at each end
    return table


def _iso_ms(value):
    if not value:
        return None
    d = datetime.fromisoformat(str(value))
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.timestamp() * 1000


def load_nights_history(folder, site, hold_out=None, min_trucks=20, max_trucks=300):
    """Nights from saved DMS pulls (`<SITE>_YYYY-MM-DD.json`), in the same shape load_nights() returns.

    Trucks are the portal's own merged rows (rejected loads dropped), so a night here is exactly what
    My Portal sees. Nights with fewer than `min_trucks` are not real shifts; nights with more than
    `max_trucks` are a pull that spilled over several dates, not one shift. `hold_out` is an optional
    ("YYYY-MM-DD", "YYYY-MM-DD") business-date range to leave out.
    """
    os.environ.setdefault("DATA_DIR", tempfile.mkdtemp(prefix="zone_model_"))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import main                                            # only for _merge_dms_portal_rows
    out = []
    for path in sorted(glob.glob(os.path.join(folder, site + "_*.json"))):
        d = json.load(open(path, encoding="utf-8"))
        m, day, y = (int(x) for x in d["info"].split("/"))
        if hold_out and hold_out[0] <= "%04d-%02d-%02d" % (y, m, day) <= hold_out[1]:
            continue
        trucks = []
        for t in main._merge_dms_portal_rows(d["loads"], d["stamps"]):
            door = str(t.get("door") or "").strip()
            trucks.append({
                "door": int(door) if door.isdigit() and int(door) > 0 else None,
                "z": zone_of(t.get("area")),
                "appt": _iso_ms(t.get("appointmentIso")),
                "ci": _iso_ms(t.get("checkInIso")),
                "us": _iso_ms(t.get("unloadStartIso")),
                "uf": _iso_ms(t.get("unloadFinishIso")) or _iso_ms(t.get("receivingFinishIso")),
            })
        if not (min_trucks <= len(trucks) <= max_trucks):
            continue
        start = (datetime(y, m, day, 19, 0, tzinfo=TZ) - timedelta(days=1)).timestamp() * 1000
        out.append({"start": start, "trucks": trucks, "date": "%04d-%02d-%02d" % (y, m, day)})
    return out


def load_nights(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    header = [str(h).strip() for h in rows[0]]
    ix = {h: i for i, h in enumerate(header)}
    nights = {}
    for r in rows[1:]:
        if str(r[ix["Delivery Status"]] or "").strip() == "Rejected":
            continue
        try:
            m, d, y = map(int, str(r[ix["Bus. Date"]]).strip().split("/"))
        except ValueError:
            continue
        door = r[ix["Door Number"]]
        nights.setdefault((y, m, d), []).append({
            "door": int(door) if isinstance(door, (int, float)) and int(door) > 0 else None,
            "z": zone_of(r[ix["Dock Type"]]),
            "appt": local_ms(r[ix["Appointment"]]),
            "ci": local_ms(r[ix["Driver Check In"]]) or local_ms(r[ix["Clerk Check In"]]),
            "us": local_ms(r[ix["Unload Start"]]),
            "uf": local_ms(r[ix["Unload Finish"]]) or local_ms(r[ix["Finish Receiving"]]),
        })
    out = []
    for (y, m, d), trucks in sorted(nights.items()):
        if len(trucks) < 20:
            continue
        start = (datetime(y, m, d, 19, 0, tzinfo=TZ) - timedelta(days=1)).timestamp() * 1000
        out.append({"start": start, "trucks": trucks})
    return out


# How each zone is modelled in the finish simulation: its own pool of `cap` servers (a percentile of "trucks being unloaded
# at once" while the zone is active) and a minimum wait of `lag` minutes (a percentile of check-in -> unload start, the wait
# that exists even when a door is free). (capacity percentile, start-lag percentile) per site and zone.
#
# Chosen by cross-validation on saved nights (each night scored by a model trained without it, error = estimate minus when 95%
# of the zone's trucks really finished), then confirmed on nights the choice never saw. Without this, every zone shared one pool
# of `doors` servers and started a truck the moment it checked in, which made the simulation finish far too early: Freezer and
# Chilled really unload one to three trucks at a time.
#   Minnesota: average error 49 -> 45 minutes on the confirmation nights (45.5 -> 41.4 on all 119), better at every hour of
#   the night, Chilled 47 -> 35, and the typical estimate no longer runs early (median -20 -> -7).
#   OKS: 68.2 -> 67.4, which is within the noise, so OKS keeps the old whole-dock pool (None = off).
# Re-check after a large change in how either dock runs (staffing, door layout).
STRUCTURE_PCT = {
    "MN":  {"freezer": (75, 25), "chilled": (50, 10), "dry": (75, 10)},
    "OKS": None,
}
CONC_STEP_MIN = 5


def _pct(values, p):
    values = sorted(values)
    return values[min(len(values) - 1, int(len(values) * p / 100))]


def zone_structure(nights, zone):
    """(lags, concurrency) samples for one zone, from trucks with real check-in, unload start and unload finish stamps.

    `lags` are check-in -> unload start in minutes. `concurrency` is how many of the zone's trucks were being unloaded at the
    same moment, sampled every few minutes while at least one was (so quiet hours do not drag it down).
    """
    lags, conc = [], []
    for night in nights:
        ts = [t for t in zone_trucks(night, zone) if t["ci"] and t["us"] and t["uf"] and t["uf"] >= t["us"]]
        for t in ts:
            lag = (t["us"] - t["ci"]) / MIN
            if 0 <= lag <= 600:
                lags.append(lag)
        if not ts:
            continue
        starts = sorted(t["us"] for t in ts)
        fins = sorted(t["uf"] for t in ts)
        at = starts[0]
        while at <= fins[-1]:
            c = bisect.bisect_right(starts, at) - bisect.bisect_right(fins, at)
            if c > 0:
                conc.append(c)
            at += CONC_STEP_MIN * MIN
    return lags, conc


def zone_trucks(night, zone):
    """Trucks in one zone; zone=None means the whole building (including unzoned trucks)."""
    if zone is None:
        return night["trucks"]
    return [t for t in night["trucks"] if t["z"] == zone]


def curve(night, zone):
    ts = zone_trucks(night, zone)
    if len(ts) < 3:
        return None
    fins = sorted(t["uf"] for t in ts if t["uf"])
    row, j = [], 0
    for k in range(STEPS + 1):
        cutoff = night["start"] + k * STEP_MIN * 60000
        while j < len(fins) and fins[j] <= cutoff:
            j += 1
        row.append(j / len(ts))
    return row


def truth_p95(night, zone):
    f = sorted(t["uf"] for t in zone_trucks(night, zone) if t["ci"] and t["uf"])
    if len(f) < 3:
        return None
    return f[min(len(f) - 1, int(len(f) * 0.95))]


def share_at(night, zone, cutoff):
    ts = zone_trucks(night, zone)
    if len(ts) < 3:
        return None
    return sum(1 for t in ts if t["uf"] and t["uf"] <= cutoff) / len(ts)


def typical_time(curve_row, share):
    """Minutes after 7 PM at which the typical curve reaches `share` (mirrors typicalTime in index.html)."""
    best = None
    for k, v in enumerate(curve_row):
        if v <= share + 1e-9:
            best = k
    if best is None:
        return 0
    if best == len(curve_row) - 1:
        for k, v in enumerate(curve_row):
            if v >= share - 1e-9:
                return k * STEP_MIN
    return best * STEP_MIN


def build(path, doors, keep_last=False):
    nights = load_nights(path)
    # An export is usually pulled while the newest business date is still running, which would
    # teach the model that nights end early. Drop that last night unless told it is complete.
    if not keep_last and len(nights) > 1:
        nights = nights[:-1]
    return build_from_nights(nights, doors)


def build_from_nights(nights, doors, site="OKS", structure=True):
    models, pace = {}, {}
    for zone, _ in ZONES:
        sched = arrived = 0
        offsets, service = [], []
        for night in nights:
            for t in zone_trucks(night, zone):
                if t["appt"]:
                    sched += 1
                    if t["ci"]:
                        arrived += 1
                        offsets.append((t["ci"] - t["appt"]) / MIN)
                if t["ci"] and t["us"] and t["uf"] and t["uf"] >= t["us"]:
                    service.append((t["uf"] - t["us"]) / MIN)
        models[zone] = {"fmax": round(arrived / sched, 3), "offsets": percentiles(offsets), "service": percentiles(service)}
        # Capacity and start lag. Without them the finish simulation lets every zone share one pool of `doors` servers and
        # start a truck the moment it checks in, which made Freezer and Chilled finish far too early (they really unload one
        # to three trucks at a time) and every zone too early by the wait that exists even on a quiet dock.
        if structure and STRUCTURE_PCT.get(site):
            cap_pct, lag_pct = STRUCTURE_PCT[site][zone]
            lags, conc = zone_structure(nights, zone)
            if conc:
                models[zone]["cap"] = max(1, _pct(conc, cap_pct))
            if lags:
                models[zone]["lag"] = round(_pct(lags, lag_pct), 1)

        curves = [c for c in (curve(n, zone) for n in nights) if c]
        typical = [round(st.median(c[k] for c in curves), 3) for k in range(STEPS + 1)]
        finishes = [(truth_p95(n, zone) - n["start"]) / MIN for n in nights if truth_p95(n, zone) is not None]
        finish = st.median(finishes)

        fit = []
        for cp in CHECKPOINTS:
            xs, ys = [], []
            for n in nights:
                tr = truth_p95(n, zone)
                cutoff = n["start"] + cp * 60000
                if tr is None or tr <= cutoff:
                    continue
                s = share_at(n, zone, cutoff)
                if s is None:
                    continue
                xs.append(cp - typical_time(typical, s))
                ys.append((tr - n["start"]) / MIN - finish)
            mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
            sxx = sum((x - mx) ** 2 for x in xs)
            sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
            b = sxy / sxx if sxx > 1e-9 else 0.0
            fit.append([round(my - b * mx, 2), round(b, 3)])
        pace[zone] = {"curve": typical, "finish": round(finish, 1), "fit": fit}

    # Whole-building average pace, so the portal can say how far ahead of or behind average the dock is.
    curves = [c for c in (curve(n, None) for n in nights) if c]
    pace["all"] = {
        "curve": [round(st.median(c[k] for c in curves), 3) for k in range(STEPS + 1)],
        "finish": round(st.median((truth_p95(n, None) - n["start"]) / MIN for n in nights if truth_p95(n, None) is not None), 1),
    }
    return {"doors": doors, "nights": len(nights), "models": models, "pace": pace, "zoneDoors": zone_doors(nights)}


def zone_doors(nights, min_loads=10, min_share=0.6, max_door=200):
    """Each zone's 'home' doors: real dock doors where one zone takes most of the loads.

    Used for the per-zone door maps on the Zones view. Doors above `max_door` are yard or
    staging placeholders, not dock doors. A zone truck on any other door still shows on its
    zone's map while it is there, so nothing is hidden.
    """
    per_door = {}
    for night in nights:
        for t in night["trucks"]:
            if t["door"] and t["door"] <= max_door:
                per_door.setdefault(t["door"], []).append(t["z"])
    out = {name: [] for name, _ in ZONES}
    for door, zs in sorted(per_door.items()):
        if len(zs) < min_loads:
            continue
        best = max((n for n, _ in ZONES), key=lambda n: zs.count(n))
        if zs.count(best) / len(zs) >= min_share:
            out[best].append(door)
    return out


if __name__ == "__main__":
    def opt(name):
        return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None
    doors = int(opt("--doors") or 6)
    if opt("--history"):
        site = (opt("--site") or "MN").upper()
        hold = tuple(opt("--hold-out").split(":")) if opt("--hold-out") else None
        model = build_from_nights(load_nights_history(opt("--history"), site, hold), doors, site)
        const = "PORTAL_ZONE_MODEL_MN" if site == "MN" else "PORTAL_ZONE_MODEL"
    else:
        args = [a for a in sys.argv[1:] if not a.startswith("--") and a != str(opt("--doors"))]
        if not args:
            sys.exit(__doc__)
        model = build(args[0], doors, keep_last="--keep-last" in sys.argv)
        const = "PORTAL_ZONE_MODEL"
    print("// built from %d nights" % model["nights"], file=sys.stderr)
    print("const " + const + " = " + json.dumps(model, separators=(",", ":")) + ";")
