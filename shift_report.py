"""End-of-shift report maths: one summary per night, plus a baseline built from earlier nights.

Pure functions only (no FastAPI, no database, no DMS calls) so they can be checked against saved
nights. main.py fetches the trucks, calls summarize_night(), caches the result and serves it.

Times inside a summary are minutes after the 7 PM shift start (the business date D runs from
7 PM on D-1 to 9 AM on D). 4 AM is minute 540, 5 AM is minute 600.

SUMMARY_VERSION is stored with every cached night; bump it whenever a summary gains or changes a
field so old cached nights are rebuilt instead of showing gaps.
"""
from datetime import datetime, time, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional

SUMMARY_VERSION = 2

STEP_MIN = 15
STEPS = 57                 # 7 PM .. 9 AM inclusive, in 15-minute steps
HOURS = 14                 # hour buckets 7 PM .. 9 AM
GOAL_MIN = 540             # 4 AM (OKS); Minnesota passes 600 for its 5 AM goal
UNLOAD_CAP_MIN = 480       # an unload longer than this is a stamping error, not a real unload
DOCK_CAP_MIN = 720
OVER_MIN = 120             # "over 2 hours on the dock" (the default free time)
MIN_NIGHT_ARRIVALS = 10    # a night with fewer arrivals is treated as "no shift" and kept out of baselines
ZONE_KEYS = ("freezer", "chilled", "dry", "other")

# Time on the dock (check-in to unload finish), in minutes: bucket edges.
DOCK_EDGES = (30, 60, 90, 120, 180, 240)
DOCK_LABELS = ("Under 30 min", "30-60 min", "1-1.5 h", "1.5-2 h", "2-3 h", "3-4 h", "4 h+")
# Arrival minus appointment, in minutes: bucket edges (negative = early).
PUNCT_EDGES = (-120, -60, -30, -15, 15, 30, 60, 120)
PUNCT_LABELS = ("2 h+ early", "1-2 h early", "30-60 min early", "15-30 min early", "On time (within 15)",
                "15-30 min late", "30-60 min late", "1-2 h late", "2 h+ late")
PALLET_EDGES = (10, 20, 30, 40)
PALLET_LABELS = ("1-10", "11-20", "21-30", "31-40", "41+")

_BASELINE_METRICS = (
    "scheduled", "arrived", "completed", "pct_by_goal", "avg_unload_min", "avg_wait_min", "avg_dock_min",
    "pallets_total", "pph", "over_2h", "rejected", "never_arrived", "p50_finish_min", "p95_finish_min",
    "last_finish_min", "peak_unloading", "avg_yard_wait_min", "avg_door_wait_min", "pallets_per_truck",
    "p25_finish_min", "p75_finish_min", "p90_finish_min", "first_start_min", "first_arrival_min",
    "doors_used", "avg_rec_lag_min", "rec_delays_45", "pallets_scheduled", "peak_on_dock", "avg_on_dock", "pre_shift_arrivals",
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


def _bucket(value: float, edges) -> int:
    """Index of the bucket `value` falls in: below edges[0] -> 0, ..., at or above the last edge -> len(edges)."""
    for i, e in enumerate(edges):
        if value < e:
            return i
    return len(edges)


def _punct_bucket(offset: float) -> int:
    """Arrival punctuality: 'on time' is the closed range -15..+15 minutes."""
    if offset < -120: return 0
    if offset < -60: return 1
    if offset < -30: return 2
    if offset < -15: return 3
    if offset <= 15: return 4
    if offset <= 30: return 5
    if offset <= 60: return 6
    if offset <= 120: return 7
    return 8


def _curve(times: List[float], weights: Optional[List[float]] = None) -> List[float]:
    """Cumulative count (or weight) of events at or before each 15-minute mark."""
    order = sorted(range(len(times)), key=lambda i: times[i])
    out, j, acc = [], 0, 0.0
    for k in range(STEPS):
        limit = k * STEP_MIN
        while j < len(order) and times[order[j]] <= limit:
            acc += weights[order[j]] if weights else 1
            j += 1
        out.append(acc)
    return out


def _zone_block(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    fins = sorted(i["fin"] for i in items if i["fin"] is not None)
    unload = [i["unload"] for i in items if i["unload"] is not None]
    waits = [i["wait"] for i in items if i["wait"] is not None]
    docks = [i["dock"] for i in items if i["dock"] is not None]
    pal_h = sum(i["unload"] / 60 for i in items if i["unload"] is not None and i["pallets"])
    pal_n = sum(i["pallets"] for i in items if i["unload"] is not None and i["pallets"])
    arr = sorted(i["ci"] for i in items if i["ci"] is not None)
    return {
        "scheduled": len(items),
        "arrived": len(arr),
        "completed": len(fins),
        "p95_finish_min": _r(_pct(fins, 0.95)),
        "avg_unload_min": _r(_mean(unload)),
        "avg_wait_min": _r(_mean(waits)),
        "avg_dock_min": _r(_mean(docks)),
        "over_2h": sum(1 for d in docks if d > OVER_MIN),
        "pph": _r(pal_n / pal_h) if pal_h > 0 else None,
        "pallets": sum(i["pallets"] or 0 for i in items if i["fin"] is not None),
        "pallets_scheduled": sum(i["pallets"] or 0 for i in items),
        "curve_fin": [int(v) for v in _curve(fins)],
        "curve_arr": [int(v) for v in _curve(arr)],
    }


def summarize_night(trucks: List[Dict[str, Any]], business_date: str, tz,
                    zone_of: Callable[[Any], str], rejected: int = 0, goal_min: int = GOAL_MIN,
                    rejected_rows: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
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
        dr = minute(t.get("driverAtDoorIso"))
        us = minute(t.get("unloadStartIso"))
        uf = minute(t.get("unloadFinishIso"))
        rs = minute(t.get("receivingStartIso"))
        rf = minute(t.get("receivingFinishIso"))
        appt = minute(t.get("appointmentIso"))
        fin = uf if uf is not None else rf
        pallets = t.get("pallets")
        pallets = pallets if isinstance(pallets, (int, float)) and pallets >= 0 else None
        door = str(t.get("door") or "").strip()
        unload = (uf - us) if (us is not None and uf is not None and 0 < uf - us <= UNLOAD_CAP_MIN) else None
        wait = (us - ci) if (ci is not None and us is not None and 0 <= us - ci <= DOCK_CAP_MIN) else None
        dock = (fin - ci) if (ci is not None and fin is not None and 0 < fin - ci <= DOCK_CAP_MIN) else None
        yard = (dr - ci) if (ci is not None and dr is not None and 0 <= dr - ci <= DOCK_CAP_MIN) else None
        dwait = (us - dr) if (dr is not None and us is not None and 0 <= us - dr <= DOCK_CAP_MIN) else None
        offset = (ci - appt) if (ci is not None and appt is not None and abs(ci - appt) <= 1440) else None
        reclag = (rs - uf) if (uf is not None and rs is not None and 0 <= rs - uf <= DOCK_CAP_MIN) else None
        recdur = (rf - rs) if (rs is not None and rf is not None and 0 <= rf - rs <= DOCK_CAP_MIN) else None
        rows.append({
            "ci": ci, "dr": dr, "us": us, "uf": uf, "rs": rs, "rf": rf, "fin": fin, "appt": appt, "pallets": pallets,
            "unload": unload, "wait": wait, "dock": dock, "yard": yard, "dwait": dwait, "offset": offset,
            "reclag": reclag, "recdur": recdur,
            "supplier": str(t.get("supplier") or "").strip(), "carrier": str(t.get("carrier") or "").strip(),
            "area": str(t.get("area") or "").strip(), "zone": zone_of(t.get("area")),
            "door": int(door) if door.isdigit() and int(door) > 0 else None,
        })

    arrived = [r for r in rows if r["ci"] is not None]
    done = [r for r in rows if r["fin"] is not None]
    open_now = [r for r in rows if r["ci"] is not None and r["fin"] is None]
    never = [r for r in rows if r["ci"] is None and r["fin"] is None]
    fins = sorted(r["fin"] for r in done)
    by_goal = sum(1 for f in fins if f <= goal_min)
    unloads = [r["unload"] for r in rows if r["unload"] is not None]
    waits = [r["wait"] for r in rows if r["wait"] is not None]
    docks = [r["dock"] for r in rows if r["dock"] is not None]
    yards = [r["yard"] for r in rows if r["yard"] is not None]
    dwaits = [r["dwait"] for r in rows if r["dwait"] is not None]
    timed_pal = [r for r in rows if r["unload"] is not None and r["pallets"]]
    pal_hours = sum(r["unload"] / 60 for r in timed_pal)
    pal_count = sum(r["pallets"] for r in timed_pal)
    arr_times = sorted(r["ci"] for r in arrived)
    starts = sorted(r["us"] for r in rows if r["us"] is not None)

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

    # The dock through the night: at each 15-minute mark, how many trucks are on it, and how many of
    # those are waiting to start versus being unloaded.
    on_dock, unloading_now, waiting_now = [], [], []
    for k in range(STEPS):
        t = k * STEP_MIN
        od = sum(1 for r in arrived if r["ci"] <= t and (r["fin"] is None or r["fin"] > t))
        un = sum(1 for r in arrived if r["us"] is not None and r["us"] <= t and (r["fin"] is None or r["fin"] > t))
        on_dock.append(od)
        unloading_now.append(un)
        waiting_now.append(max(0, od - un))

    hourly = []
    for h in range(HOURS):
        lo, hi = h * 60, (h + 1) * 60
        in_h = [r for r in rows if r["ci"] is not None and lo <= r["ci"] < hi]
        st_h = [r for r in rows if r["us"] is not None and lo <= r["us"] < hi]
        fin_h = [r for r in rows if r["fin"] is not None and lo <= r["fin"] < hi]
        w = [r["wait"] for r in in_h if r["wait"] is not None]
        u = [r["unload"] for r in st_h if r["unload"] is not None]
        hourly.append({
            "arrivals": len(in_h),
            "starts": len(st_h),
            "finishes": len(fin_h),
            "appts": sum(1 for r in rows if r["appt"] is not None and lo <= r["appt"] < hi),
            "pallets_in": sum(r["pallets"] or 0 for r in in_h),
            "pallets_out": sum(r["pallets"] or 0 for r in fin_h),
            "wait_avg": _r(_mean(w)),
            "unload_avg": _r(_mean(u)),
        })

    fin_times = [r["fin"] for r in done]
    fin_weights = [r["pallets"] or 0 for r in done]
    curve_fin = [int(v) for v in _curve(fin_times)]
    curve_arr = [int(v) for v in _curve([r["ci"] for r in arrived])]
    pallets_curve = [int(v) for v in _curve(fin_times, fin_weights)]

    dock_hist = [0] * (len(DOCK_EDGES) + 1)
    for d in docks:
        dock_hist[_bucket(d, DOCK_EDGES)] += 1
    punct_counts = [0] * len(PUNCT_LABELS)
    offsets = [r["offset"] for r in rows if r["offset"] is not None]
    for o in offsets:
        punct_counts[_punct_bucket(o)] += 1
    pallet_hist = [0] * (len(PALLET_EDGES) + 1)
    unknown_pallets = 0
    for r in arrived:
        if r["pallets"] is None or r["pallets"] <= 0:
            unknown_pallets += 1
        else:
            pallet_hist[_bucket(r["pallets"] - 1, tuple(e for e in PALLET_EDGES))] += 1

    zones: Dict[str, Any] = {}
    for key in ZONE_KEYS:
        items = [r for r in rows if r["zone"] == key]
        if items:
            zones[key] = _zone_block(items)

    # Doors: how many trucks and pallets each door handled and how long it spent unloading.
    door_acc: Dict[int, Dict[str, float]] = {}
    for r in rows:
        if r["door"] is None or (r["us"] is None and r["fin"] is None):
            continue
        d = door_acc.setdefault(r["door"], {"trucks": 0, "pallets": 0, "busy": 0.0, "n_busy": 0})
        d["trucks"] += 1
        d["pallets"] += r["pallets"] or 0
        if r["unload"] is not None:
            d["busy"] += r["unload"]
            d["n_busy"] += 1
    door_rows = sorted(({"door": k, "trucks": int(v["trucks"]), "pallets": int(v["pallets"]), "busy_min": _r(v["busy"]),
                         "avg_unload_min": _r(v["busy"] / v["n_busy"]) if v["n_busy"] else None} for k, v in door_acc.items()),
                       key=lambda x: (-x["trucks"], x["door"]))

    def supplier_block(field: str) -> Dict[str, List[Dict[str, Any]]]:
        acc: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            name = r[field]
            if name and r["dock"] is not None:
                s = acc.setdefault(name, {"name": name, "trucks": 0, "dock_total": 0.0, "dock_max": 0.0, "pallets": 0})
                s["trucks"] += 1
                s["dock_total"] += r["dock"]
                s["dock_max"] = max(s["dock_max"], r["dock"])
                s["pallets"] += r["pallets"] or 0
        out = [{"name": s["name"], "trucks": s["trucks"], "avg_dock_min": _r(s["dock_total"] / s["trucks"]),
                "max_dock_min": _r(s["dock_max"]), "pallets": s["pallets"]} for s in acc.values()]
        return {
            "slowest": sorted((s for s in out if s["trucks"] >= 2), key=lambda s: -s["avg_dock_min"])[:10],
            "busiest": sorted(out, key=lambda s: (-s["trucks"], -s["avg_dock_min"]))[:8],
            "top_pallets": sorted(out, key=lambda s: (-s["pallets"], -s["trucks"]))[:10],
        }

    sup = supplier_block("supplier")
    car = supplier_block("carrier")

    no_show_rows = sorted(never, key=lambda r: (r["appt"] if r["appt"] is not None else 9999))
    no_shows = [{"supplier": r["supplier"], "area": r["area"], "appt_min": _r(r["appt"]), "pallets": r["pallets"]} for r in no_show_rows[:40]]
    longest = sorted((r for r in rows if r["dock"] is not None), key=lambda r: -r["dock"])[:10]
    longest_docks = [{"supplier": r["supplier"], "door": r["door"], "area": r["area"], "dock_min": _r(r["dock"]),
                      "wait_min": _r(r["wait"]), "unload_min": _r(r["unload"]), "pallets": r["pallets"]} for r in longest]
    rej_rows = rejected_rows or []
    rejected_detail = [{"supplier": str(x.get("supplier") or "").strip(), "area": str(x.get("area") or "").strip(),
                        "pallets": x.get("pallets") if isinstance(x.get("pallets"), (int, float)) else None}
                       for x in rej_rows[:30]]
    reclags = [r["reclag"] for r in rows if r["reclag"] is not None]
    recdurs = [r["recdur"] for r in rows if r["recdur"] is not None]
    d0 = parse_business_date(business_date)

    return {
        "v": SUMMARY_VERSION,
        "business_date": business_date,
        "weekday": d0.weekday() if d0 else None,
        "shift_start": start.isoformat(),
        "goal_min": goal_min,
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
        "first_start_min": _r(starts[0]) if starts else None,
        "p25_finish_min": _r(_pct(fins, 0.25)),
        "p50_finish_min": _r(_pct(fins, 0.5)),
        "p75_finish_min": _r(_pct(fins, 0.75)),
        "p90_finish_min": _r(_pct(fins, 0.9)),
        "p95_finish_min": _r(_pct(fins, 0.95)),
        "last_finish_min": _r(fins[-1]) if fins else None,
        "avg_unload_min": _r(_mean(unloads)),
        "avg_wait_min": _r(_mean(waits)),
        "avg_yard_wait_min": _r(_mean(yards)),
        "avg_door_wait_min": _r(_mean(dwaits)),
        "avg_dock_min": _r(_mean(docks)),
        "over_2h": sum(1 for d in docks if d > OVER_MIN),
        "pallets_total": sum(r["pallets"] or 0 for r in done),
        "pallets_scheduled": sum(r["pallets"] or 0 for r in rows),
        "pallets_per_truck": _r(sum(r["pallets"] or 0 for r in arrived) / len([r for r in arrived if r["pallets"]])) if any(r["pallets"] for r in arrived) else None,
        "pph": _r(pal_count / pal_hours) if pal_hours > 0 else None,
        "timed_unloads": len(unloads),
        "peak_unloading": peak,
        "peak_on_dock": max(on_dock) if on_dock else 0,
        "avg_on_dock": _r(_mean([v for v in on_dock[:49]])),         # 7 PM .. 7 AM, the working part of the night
        "doors_used": len(door_rows),
        "avg_rec_lag_min": _r(_mean(reclags)),
        "avg_rec_min": _r(_mean(recdurs)),
        "rec_delays_45": sum(1 for x in reclags if x > 45),
        "rec_open": sum(1 for r in rows if r["uf"] is not None and r["rf"] is None),
        "pre_shift_arrivals": sum(1 for r in arrived if r["ci"] < 0),      # checked in before the 7 PM start
        "hourly": hourly,
        "curve_fin": curve_fin,
        "curve_arr": curve_arr,
        "pallets_curve": pallets_curve,
        "queue": {"on_dock": on_dock, "waiting": waiting_now, "unloading": unloading_now},
        "dock_hist": dock_hist,
        "punctuality": {
            "counts": punct_counts, "n": len(offsets), "avg_offset_min": _r(_mean(offsets)),
            "early_pct": _r(100.0 * sum(punct_counts[:4]) / len(offsets)) if offsets else None,
            "on_time_pct": _r(100.0 * punct_counts[4] / len(offsets)) if offsets else None,
            "late_pct": _r(100.0 * sum(punct_counts[5:]) / len(offsets)) if offsets else None,
        },
        "pallet_hist": pallet_hist,
        "pallet_unknown": unknown_pallets,
        "zones": zones,
        "doors": door_rows[:20],
        "suppliers": {"slowest": [dict(s, supplier=s["name"]) for s in sup["slowest"]],
                      "busiest": [dict(s, supplier=s["name"]) for s in sup["busiest"]],
                      "top_pallets": [dict(s, supplier=s["name"]) for s in sup["top_pallets"]]},
        "carriers": {"slowest": [dict(s, carrier=s["name"]) for s in car["slowest"]],
                     "busiest": [dict(s, carrier=s["name"]) for s in car["busiest"]]},
        "no_shows": no_shows,
        "rejected_detail": rejected_detail,
        "longest_docks": longest_docks,
    }


def _mean_list(lists: List[List[Optional[float]]], places: int = 1) -> List[Optional[float]]:
    out = []
    for k in range(len(lists[0])):
        vals = [l[k] for l in lists if l[k] is not None]
        out.append(_r(_mean(vals), places))
    return out


def build_baseline(previous: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Average of the earlier nights that really ran (nights with almost no arrivals are skipped)."""
    use = [s for s in previous if s and s.get("has_data")]
    if not use:
        return None
    out: Dict[str, Any] = {"nights": len(use), "dates": [s["business_date"] for s in use]}
    for key in _BASELINE_METRICS:
        out[key] = _r(_mean([s[key] for s in use if s.get(key) is not None]))
    for key in ("curve_fin", "curve_arr", "pallets_curve", "dock_hist", "pallet_hist"):
        out[key] = _mean_list([s[key] for s in use if s.get(key) is not None])
    out["queue"] = {k: _mean_list([s["queue"][k] for s in use if s.get("queue")]) for k in ("on_dock", "waiting", "unloading")}
    out["punctuality"] = {
        "counts": _mean_list([s["punctuality"]["counts"] for s in use if s.get("punctuality")]),
        "avg_offset_min": _r(_mean([s["punctuality"]["avg_offset_min"] for s in use if s.get("punctuality") and s["punctuality"]["avg_offset_min"] is not None])),
        "early_pct": _r(_mean([s["punctuality"]["early_pct"] for s in use if s.get("punctuality") and s["punctuality"]["early_pct"] is not None])),
        "on_time_pct": _r(_mean([s["punctuality"]["on_time_pct"] for s in use if s.get("punctuality") and s["punctuality"]["on_time_pct"] is not None])),
        "late_pct": _r(_mean([s["punctuality"]["late_pct"] for s in use if s.get("punctuality") and s["punctuality"]["late_pct"] is not None])),
    }
    out["hourly"] = [
        {f: _r(_mean([s["hourly"][h][f] for s in use if s["hourly"][h].get(f) is not None]))
         for f in ("arrivals", "starts", "finishes", "appts", "pallets_in", "pallets_out", "wait_avg", "unload_avg")}
        for h in range(HOURS)
    ]
    zones: Dict[str, Any] = {}
    for key in ZONE_KEYS:
        have = [s["zones"][key] for s in use if key in s["zones"]]
        if have:
            z = {m: _r(_mean([x[m] for x in have if x.get(m) is not None]))
                 for m in ("scheduled", "arrived", "completed", "p95_finish_min", "avg_unload_min", "avg_wait_min", "avg_dock_min", "over_2h", "pph", "pallets", "pallets_scheduled")}
            z["curve_fin"] = _mean_list([x["curve_fin"] for x in have if x.get("curve_fin")])
            zones[key] = z
    out["zones"] = zones
    return out
