"""End-of-shift report maths: one summary per night, plus a baseline built from earlier nights.

Pure functions only (no FastAPI, no database, no DMS calls) so they can be checked against saved
nights. main.py fetches the trucks, calls summarize_night(), caches the result and serves it.

Times inside a summary are minutes after the 7 PM shift start (the business date D runs from
7 PM on D-1 to 9 AM on D). 4 AM is minute 540.
"""
from datetime import datetime, time, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional

STEP_MIN = 15
STEPS = 57                 # 7 PM .. 9 AM inclusive, in 15-minute steps
HOURS = 14                 # hour buckets 7 PM .. 9 AM
GOAL_MIN = 540             # 4 AM
UNLOAD_CAP_MIN = 480       # an unload longer than this is a stamping error, not a real unload
DOCK_CAP_MIN = 720
OVER_MIN = 120             # "over 2 hours on the dock" (the default free time)
MIN_NIGHT_ARRIVALS = 10    # a night with fewer arrivals is treated as "no shift" and kept out of baselines
ZONE_KEYS = ("freezer", "chilled", "dry", "other")

_BASELINE_METRICS = (
    "scheduled", "arrived", "completed", "pct_by_goal", "avg_unload_min", "avg_wait_min", "avg_dock_min",
    "pallets_total", "pph", "over_2h", "rejected", "never_arrived", "p50_finish_min", "p95_finish_min",
    "last_finish_min", "peak_unloading",
)


def parse_iso(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def parse_business_date(text: str) -> Optional[datetime]:
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(text).strip(), fmt)
        except ValueError:
            pass
    return None


def shift_start(business_date: str, tz) -> Optional[datetime]:
    d = parse_business_date(business_date)
    if not d:
        return None
    return datetime.combine(d.date() - timedelta(days=1), time(19, 0), tzinfo=tz)


def _mean(values: List[float]) -> Optional[float]:
    return sum(values) / len(values) if values else None


def _pct(sorted_values: List[float], q: float) -> Optional[float]:
    """Same rule the finish simulation uses: the value at index floor(n * q), capped at the last."""
    if not sorted_values:
        return None
    return sorted_values[min(len(sorted_values) - 1, int(len(sorted_values) * q))]


def _r(value: Optional[float], places: int = 1) -> Optional[float]:
    return None if value is None else round(value, places)


def _zone_block(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    fins = sorted(i["fin"] for i in items if i["fin"] is not None)
    unload = [i["unload"] for i in items if i["unload"] is not None]
    pal_h = sum(i["unload"] / 60 for i in items if i["unload"] is not None and i["pallets"])
    pal_n = sum(i["pallets"] for i in items if i["unload"] is not None and i["pallets"])
    return {
        "scheduled": len(items),
        "arrived": sum(1 for i in items if i["ci"] is not None),
        "completed": len(fins),
        "p95_finish_min": _r(_pct(fins, 0.95)),
        "avg_unload_min": _r(_mean(unload)),
        "pph": _r(pal_n / pal_h) if pal_h > 0 else None,
        "pallets": sum(i["pallets"] or 0 for i in items if i["fin"] is not None),
    }


def summarize_night(trucks: List[Dict[str, Any]], business_date: str, tz,
                    zone_of: Callable[[Any], str], rejected: int = 0) -> Dict[str, Any]:
    """Everything the report needs about one night. `trucks` are the merged DMS rows for the date,
    non-rejected, whether or not they ever checked in. `zone_of` maps an area name to a zone key."""
    start = shift_start(business_date, tz)
    if start is None:
        raise ValueError("bad business date: %r" % business_date)

    def minute(value: Any) -> Optional[float]:
        dt = parse_iso(value)
        return (dt - start).total_seconds() / 60.0 if dt else None

    rows: List[Dict[str, Any]] = []
    for t in trucks:
        ci = minute(t.get("checkInIso"))
        us = minute(t.get("unloadStartIso"))
        uf = minute(t.get("unloadFinishIso"))
        rf = minute(t.get("receivingFinishIso"))
        fin = uf if uf is not None else rf
        pallets = t.get("pallets")
        pallets = pallets if isinstance(pallets, (int, float)) and pallets >= 0 else None
        unload = (uf - us) if (us is not None and uf is not None and 0 < uf - us <= UNLOAD_CAP_MIN) else None
        wait = (us - ci) if (ci is not None and us is not None and 0 <= us - ci <= DOCK_CAP_MIN) else None
        dock = (fin - ci) if (ci is not None and fin is not None and 0 < fin - ci <= DOCK_CAP_MIN) else None
        rows.append({
            "ci": ci, "us": us, "uf": uf, "fin": fin, "pallets": pallets, "unload": unload, "wait": wait, "dock": dock,
            "supplier": str(t.get("supplier") or "").strip(), "zone": zone_of(t.get("area")),
        })

    arrived = [r for r in rows if r["ci"] is not None]
    done = [r for r in rows if r["fin"] is not None]
    open_now = [r for r in rows if r["ci"] is not None and r["fin"] is None]
    never = [r for r in rows if r["ci"] is None and r["fin"] is None]
    fins = sorted(r["fin"] for r in done)
    by_goal = sum(1 for f in fins if f <= GOAL_MIN)
    unloads = [r["unload"] for r in rows if r["unload"] is not None]
    waits = [r["wait"] for r in rows if r["wait"] is not None]
    docks = [r["dock"] for r in rows if r["dock"] is not None]
    timed_pal = [r for r in rows if r["unload"] is not None and r["pallets"]]
    pal_hours = sum(r["unload"] / 60 for r in timed_pal)
    pal_count = sum(r["pallets"] for r in timed_pal)

    # Trucks being unloaded at the same moment (sweep over start / finish events).
    events: List[Any] = []
    for r in rows:
        if r["unload"] is not None:
            events.append((r["us"], 1))
            events.append((r["uf"], -1))
    events.sort(key=lambda e: (e[0], e[1]))
    live = peak = 0
    for _, step in events:
        live += step
        peak = max(peak, live)

    hourly = []
    for h in range(HOURS):
        lo, hi = h * 60, (h + 1) * 60
        hourly.append({
            "arrivals": sum(1 for r in rows if r["ci"] is not None and lo <= r["ci"] < hi),
            "starts": sum(1 for r in rows if r["us"] is not None and lo <= r["us"] < hi),
            "finishes": sum(1 for r in rows if r["fin"] is not None and lo <= r["fin"] < hi),
        })
    arr_times = sorted(r["ci"] for r in arrived)
    curve_fin = [sum(1 for f in fins if f <= k * STEP_MIN) for k in range(STEPS)]
    curve_arr = [sum(1 for a in arr_times if a <= k * STEP_MIN) for k in range(STEPS)]

    zones: Dict[str, Any] = {}
    for key in ZONE_KEYS:
        items = [r for r in rows if r["zone"] == key]
        if items:
            zones[key] = _zone_block(items)

    sup: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        if r["supplier"] and r["dock"] is not None:
            s = sup.setdefault(r["supplier"], {"supplier": r["supplier"], "trucks": 0, "dock_total": 0.0, "dock_max": 0.0, "pallets": 0})
            s["trucks"] += 1
            s["dock_total"] += r["dock"]
            s["dock_max"] = max(s["dock_max"], r["dock"])
            s["pallets"] += r["pallets"] or 0
    sup_rows = [{"supplier": s["supplier"], "trucks": s["trucks"], "avg_dock_min": _r(s["dock_total"] / s["trucks"]),
                 "max_dock_min": _r(s["dock_max"]), "pallets": s["pallets"]} for s in sup.values()]
    slowest = sorted((s for s in sup_rows if s["trucks"] >= 2), key=lambda s: -s["avg_dock_min"])[:10]
    busiest = sorted(sup_rows, key=lambda s: (-s["trucks"], -s["avg_dock_min"]))[:8]

    return {
        "business_date": business_date,
        "shift_start": start.isoformat(),
        "has_data": len(arrived) >= MIN_NIGHT_ARRIVALS,
        "complete": bool(arrived) and not open_now,
        "scheduled": len(rows),
        "arrived": len(arrived),
        "completed": len(done),
        "open": len(open_now),
        "never_arrived": len(never),
        "rejected": int(rejected),
        "finished_by_goal": by_goal,
        "pct_by_goal": _r(100.0 * by_goal / len(arrived)) if arrived else None,
        "first_arrival_min": _r(arr_times[0]) if arr_times else None,
        "p50_finish_min": _r(_pct(fins, 0.5)),
        "p90_finish_min": _r(_pct(fins, 0.9)),
        "p95_finish_min": _r(_pct(fins, 0.95)),
        "last_finish_min": _r(fins[-1]) if fins else None,
        "avg_unload_min": _r(_mean(unloads)),
        "avg_wait_min": _r(_mean(waits)),
        "avg_dock_min": _r(_mean(docks)),
        "over_2h": sum(1 for d in docks if d > OVER_MIN),
        "pallets_total": sum(r["pallets"] or 0 for r in done),
        "pallets_scheduled": sum(r["pallets"] or 0 for r in rows),
        "pph": _r(pal_count / pal_hours) if pal_hours > 0 else None,
        "timed_unloads": len(unloads),
        "peak_unloading": peak,
        "hourly": hourly,
        "curve_fin": curve_fin,
        "curve_arr": curve_arr,
        "zones": zones,
        "suppliers": {"slowest": slowest, "busiest": busiest},
    }


def build_baseline(previous: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Average of the earlier nights that really ran (nights with almost no arrivals are skipped)."""
    use = [s for s in previous if s and s.get("has_data")]
    if not use:
        return None
    out: Dict[str, Any] = {"nights": len(use), "dates": [s["business_date"] for s in use]}
    for key in _BASELINE_METRICS:
        out[key] = _r(_mean([s[key] for s in use if s.get(key) is not None]))
    out["curve_fin"] = [_r(_mean([s["curve_fin"][k] for s in use])) for k in range(STEPS)]
    out["curve_arr"] = [_r(_mean([s["curve_arr"][k] for s in use])) for k in range(STEPS)]
    out["hourly"] = [
        {f: _r(_mean([s["hourly"][h][f] for s in use])) for f in ("arrivals", "starts", "finishes")}
        for h in range(HOURS)
    ]
    zones: Dict[str, Any] = {}
    for key in ZONE_KEYS:
        have = [s["zones"][key] for s in use if key in s["zones"]]
        if have:
            zones[key] = {m: _r(_mean([z[m] for z in have if z.get(m) is not None]))
                          for m in ("scheduled", "arrived", "completed", "p95_finish_min", "avg_unload_min", "pph", "pallets")}
    out["zones"] = zones
    return out
