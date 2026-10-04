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

SUMMARY_VERSION = 4

STEP_MIN = 15
STEPS = 57                 # 7 PM .. 9 AM inclusive, in 15-minute steps
HOURS = 14                 # hour buckets 7 PM .. 9 AM
GOAL_MIN = 540             # 4 AM (OKS); Minnesota passes 600 for its 5 AM goal
UNLOAD_CAP_MIN = 480       # an unload longer than this is a stamping error, not a real unload
DOCK_CAP_MIN = 720
OVER_MIN = 120             # "over 2 hours on the dock" (the default free time)
LONG_UNLOAD_MIN = 45       # an unload longer than this is flagged "unloading over 45 min" on the live Zones screen

# Zone grade (user, 2026-10-03: "I also want scorecard grades"): a 100-point score per zone and night, worked out from five measured
# things so every point can be explained. The rubric is mine, not the user's: change these numbers to change the grading.
#   finish   40  full marks at or before the goal; lose 1 point for every 2 minutes the zone's 95%-done time is past it (0 at 80 min past)
#   by_goal  25  the share of trucks that arrived and were finished by the goal, times 25
#   waiting  15  15 minus the share of trucks that waited over 30 minutes to start once they were READY, times 15 (ready = the later of
#                check-in and the DMS appointment time, so a truck that came early and sat before its appointment is not held against the zone)
#   speed    10  10 minus the share of timed unloads that ran over 45 minutes, times 10
#   dock     10  10 minus the share of finished trucks that spent over 2 hours on the dock, times 10
# Letter: A 90+, B 80+, C 70+, D 60+, otherwise F. A zone needs 3 finished trucks to be graded.
GRADE_MAX = {"finish": 40, "by_goal": 25, "waiting": 15, "speed": 10, "dock": 10}
GRADE_LATE_LOSS_PER_MIN = 0.5
GRADE_MIN_FINISHED = 3
GRADE_LETTERS = ((90, "A"), (80, "B"), (70, "C"), (60, "D"))


def grade_letter(score: float) -> str:
    for floor, letter in GRADE_LETTERS:
        if score >= floor:
            return letter
    return "F"


def zone_grade(block: Dict[str, Any], goal_min: int) -> Optional[Dict[str, Any]]:
    """Score and letter for one zone's night from its block (see the rubric above), or None when too few trucks finished."""
    if block["completed"] < GRADE_MIN_FINISHED or block.get("p95_finish_min") is None:
        return None
    past = block["p95_finish_min"] - goal_min
    timed, done, ready_n = block["timed_unloads"], block["completed"], block["ready_wait_n"]
    share = lambda n, d: min(1.0, n / d) if d else 0.0
    parts = [
        {"key": "finish", "max": GRADE_MAX["finish"], "pts": max(0.0, min(40.0, 40.0 - max(0.0, past) * GRADE_LATE_LOSS_PER_MIN)), "value": _r(past)},
        {"key": "by_goal", "max": GRADE_MAX["by_goal"], "pts": 25.0 * (block["pct_by_goal"] or 0.0) / 100.0, "value": block["pct_by_goal"]},
        {"key": "waiting", "max": GRADE_MAX["waiting"], "pts": 15.0 * (1 - share(block["ready_waited_30"], ready_n)), "value": _r(100.0 * share(block["ready_waited_30"], ready_n))},
        {"key": "speed", "max": GRADE_MAX["speed"], "pts": 10.0 * (1 - share(block["long_unloads"], timed)), "value": _r(100.0 * share(block["long_unloads"], timed))},
        {"key": "dock", "max": GRADE_MAX["dock"], "pts": 10.0 * (1 - share(block["over_2h"], done)), "value": _r(100.0 * share(block["over_2h"], done))},
    ]
    for part in parts:
        part["pts"] = round(part["pts"], 1)
    score = int(sum(part["pts"] for part in parts) + 0.5 + 1e-9)          # halves round up (Python's round() would round 83.5 and 84.5 differently)
    return {"score": score, "letter": grade_letter(score), "parts": parts}
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


_ZONE_BASELINE_METRICS = (
    "scheduled", "arrived", "completed", "open", "never_arrived", "rejected", "pallets", "pallets_scheduled", "pallets_per_truck",
    "first_arrival_min", "first_start_min", "p50_finish_min", "p90_finish_min", "p95_finish_min", "last_finish_min", "finished_by_goal", "pct_by_goal",
    "avg_unload_min", "p50_unload_min", "p90_unload_min", "max_unload_min", "long_unloads", "pph",
    "avg_wait_min", "p90_wait_min", "max_wait_min", "waited_30", "waited_60", "avg_yard_wait_min", "avg_door_wait_min",
    "avg_ready_wait_min", "ready_waited_30", "avg_dock_min", "p90_dock_min", "longest_dock_min", "over_2h", "over_3h", "avg_rec_lag_min", "rec_delays_45",
    "on_time_pct", "early_pct", "late_pct", "avg_offset_min", "peak_on_dock", "avg_on_dock", "peak_unloading", "doors_used", "grade_score",
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


def _zone_block(items: List[Dict[str, Any]], goal_min: int = GOAL_MIN) -> Dict[str, Any]:
    """Everything one zone's end-of-shift scorecard needs. `items` are that zone's truck rows (see summarize_night)."""
    fins = sorted(i["fin"] for i in items if i["fin"] is not None)
    unload = [i["unload"] for i in items if i["unload"] is not None]
    waits = [i["wait"] for i in items if i["wait"] is not None]
    docks = [i["dock"] for i in items if i["dock"] is not None]
    yards = [i["yard"] for i in items if i["yard"] is not None]
    dwaits = [i["dwait"] for i in items if i["dwait"] is not None]
    reclags = [i["reclag"] for i in items if i["reclag"] is not None]
    offsets = [i["offset"] for i in items if i["offset"] is not None]
    # wait to start counted from when the truck was ready: the later of check-in and its appointment (never below zero)
    ready_waits = []
    for i in items:
        if i["ci"] is not None and i["us"] is not None:
            ready_from = max(i["ci"], i["appt"]) if i["appt"] is not None else i["ci"]
            w = max(0.0, i["us"] - ready_from)
            if w <= DOCK_CAP_MIN:
                ready_waits.append(w)
    pal_h = sum(i["unload"] / 60 for i in items if i["unload"] is not None and i["pallets"])
    pal_n = sum(i["pallets"] for i in items if i["unload"] is not None and i["pallets"])
    arrived = [i for i in items if i["ci"] is not None]
    arr = sorted(i["ci"] for i in arrived)
    starts = sorted(i["us"] for i in items if i["us"] is not None)
    by_goal = sum(1 for f in fins if f <= goal_min)
    un_sorted, wait_sorted, dock_sorted = sorted(unload), sorted(waits), sorted(docks)

    # The zone's trucks on the dock at each 15-minute mark, how many of them were waiting to start, and the most unloading at once.
    on_dock, waiting_now, unloading_now = [], [], []
    for k in range(STEPS):
        t = k * STEP_MIN
        od = sum(1 for r in arrived if r["ci"] <= t and (r["fin"] is None or r["fin"] > t))
        un = sum(1 for r in arrived if r["us"] is not None and r["us"] <= t and (r["fin"] is None or r["fin"] > t))
        on_dock.append(od)
        unloading_now.append(un)
        waiting_now.append(max(0, od - un))
    events: List[Any] = []
    for r in items:
        if r["unload"] is not None:
            events.append((r["us"], 1))
            events.append((r["uf"], -1))
    events.sort(key=lambda e: (e[0], e[1]))
    live = peak_unloading = 0
    for _, step in events:
        live += step
        peak_unloading = max(peak_unloading, live)
    peak_on_dock = max(on_dock) if on_dock else 0

    hourly = []
    for h in range(HOURS):
        lo, hi = h * 60, (h + 1) * 60
        in_h = [r for r in items if r["ci"] is not None and lo <= r["ci"] < hi]
        fin_h = [r for r in items if r["fin"] is not None and lo <= r["fin"] < hi]
        hourly.append({"arrivals": len(in_h), "finishes": len(fin_h), "pallets_out": sum(r["pallets"] or 0 for r in fin_h)})

    punct = [0] * len(PUNCT_LABELS)
    for o in offsets:
        punct[_punct_bucket(o)] += 1

    door_acc: Dict[int, Dict[str, float]] = {}
    for r in items:
        if r["door"] is None or (r["us"] is None and r["fin"] is None):
            continue
        d = door_acc.setdefault(r["door"], {"trucks": 0, "pallets": 0, "busy": 0.0, "n": 0})
        d["trucks"] += 1
        d["pallets"] += r["pallets"] or 0
        if r["unload"] is not None:
            d["busy"] += r["unload"]
            d["n"] += 1
    doors = sorted(({"door": k, "trucks": int(v["trucks"]), "pallets": int(v["pallets"]),
                     "avg_unload_min": _r(v["busy"] / v["n"]) if v["n"] else None} for k, v in door_acc.items()),
                   key=lambda x: (-x["trucks"], x["door"]))

    sup_acc: Dict[str, Dict[str, Any]] = {}
    for r in items:
        if r["supplier"] and (r["fin"] is not None or r["ci"] is not None):
            sp = sup_acc.setdefault(r["supplier"], {"name": r["supplier"], "trucks": 0, "pallets": 0, "dock_total": 0.0, "n_dock": 0})
            sp["trucks"] += 1
            sp["pallets"] += r["pallets"] or 0
            if r["dock"] is not None:
                sp["dock_total"] += r["dock"]
                sp["n_dock"] += 1
    suppliers = sorted(({"supplier": v["name"], "trucks": v["trucks"], "pallets": v["pallets"],
                         "avg_dock_min": _r(v["dock_total"] / v["n_dock"]) if v["n_dock"] else None} for v in sup_acc.values()),
                       key=lambda x: (-x["pallets"], -x["trucks"], x["supplier"]))[:6]
    longest = sorted((r for r in items if r["dock"] is not None), key=lambda r: -r["dock"])[:5]
    longest_docks = [{"supplier": r["supplier"], "door": r["door"], "dock_min": _r(r["dock"]), "wait_min": _r(r["wait"]),
                      "unload_min": _r(r["unload"]), "pallets": r["pallets"]} for r in longest]
    slowest = sorted((r for r in items if r["unload"] is not None), key=lambda r: -r["unload"])[:5]
    slowest_unloads = [{"supplier": r["supplier"], "door": r["door"], "unload_min": _r(r["unload"]), "pallets": r["pallets"]} for r in slowest]

    block = {
        # volume
        "scheduled": len(items),
        "arrived": len(arr),
        "completed": len(fins),
        "open": sum(1 for i in items if i["ci"] is not None and i["fin"] is None),
        "never_arrived": sum(1 for i in items if i["ci"] is None and i["fin"] is None),
        "rejected": 0,                                  # filled in by summarize_night (rejected loads are not in `items`)
        "pallets": sum(i["pallets"] or 0 for i in items if i["fin"] is not None),
        "pallets_scheduled": sum(i["pallets"] or 0 for i in items),
        "pallets_per_truck": _r(sum(i["pallets"] or 0 for i in arrived) / len([i for i in arrived if i["pallets"]])) if any(i["pallets"] for i in arrived) else None,
        # when the zone finished
        "first_arrival_min": _r(arr[0]) if arr else None,
        "first_start_min": _r(starts[0]) if starts else None,
        "p50_finish_min": _r(_pct(fins, 0.5)),
        "p90_finish_min": _r(_pct(fins, 0.9)),
        "p95_finish_min": _r(_pct(fins, 0.95)),
        "last_finish_min": _r(fins[-1]) if fins else None,
        "finished_by_goal": by_goal,
        "pct_by_goal": _r(100.0 * by_goal / len(arr)) if arr else None,
        # unloading speed
        "avg_unload_min": _r(_mean(unload)),
        "p50_unload_min": _r(_pct(un_sorted, 0.5)),
        "p90_unload_min": _r(_pct(un_sorted, 0.9)),
        "max_unload_min": _r(un_sorted[-1]) if un_sorted else None,
        "long_unloads": sum(1 for u in unload if u > LONG_UNLOAD_MIN),
        "pph": _r(pal_n / pal_h) if pal_h > 0 else None,
        "timed_unloads": len(unload),
        # waiting
        "avg_wait_min": _r(_mean(waits)),
        "p90_wait_min": _r(_pct(wait_sorted, 0.9)),
        "max_wait_min": _r(wait_sorted[-1]) if wait_sorted else None,
        "waited_30": sum(1 for w in waits if w > 30),
        "waited_60": sum(1 for w in waits if w > 60),
        "avg_yard_wait_min": _r(_mean(yards)),
        "avg_door_wait_min": _r(_mean(dwaits)),
        "ready_wait_n": len(ready_waits),
        "avg_ready_wait_min": _r(_mean(ready_waits)),
        "ready_waited_30": sum(1 for w in ready_waits if w > 30),
        # time on the dock
        "avg_dock_min": _r(_mean(docks)),
        "p90_dock_min": _r(_pct(dock_sorted, 0.9)),
        "longest_dock_min": _r(dock_sorted[-1]) if dock_sorted else None,
        "over_2h": sum(1 for d in docks if d > OVER_MIN),
        "over_3h": sum(1 for d in docks if d > 180),
        # receiving after the unload
        "avg_rec_lag_min": _r(_mean(reclags)),
        "rec_delays_45": sum(1 for x in reclags if x > 45),
        "rec_open": sum(1 for i in items if i["uf"] is not None and i["rf"] is None),
        # arrivals against the appointment
        "punct_n": len(offsets),
        "on_time_pct": _r(100.0 * punct[4] / len(offsets)) if offsets else None,
        "early_pct": _r(100.0 * sum(punct[:4]) / len(offsets)) if offsets else None,
        "late_pct": _r(100.0 * sum(punct[5:]) / len(offsets)) if offsets else None,
        "avg_offset_min": _r(_mean(offsets)),
        # load on the zone's doors
        "peak_on_dock": peak_on_dock,
        "peak_on_dock_at_min": on_dock.index(peak_on_dock) * STEP_MIN if peak_on_dock else None,
        "avg_on_dock": _r(_mean(on_dock[:49])),
        "peak_unloading": peak_unloading,
        "doors_used": len(doors),
        # through the night
        "curve_fin": [int(v) for v in _curve(fins)],
        "curve_arr": [int(v) for v in _curve(sorted(i["ci"] for i in arrived))],
        "on_dock": on_dock,
        "waiting": waiting_now,
        "unloading": unloading_now,
        "hourly": hourly,
        # who and what
        "doors": doors[:6],
        "suppliers": suppliers,
        "longest_docks": longest_docks,
        "slowest_unloads": slowest_unloads,
    }
    block["grade"] = zone_grade(block, goal_min)
    block["grade_score"] = block["grade"]["score"] if block["grade"] else None
    return block


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
            zones[key] = _zone_block(items, goal_min)

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
    for x in rej_rows:                                  # rejected loads are not in `rows`, so count them per zone here
        k = zone_of(x.get("area"))
        if k in zones:
            zones[k]["rejected"] += 1
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
                 for m in _ZONE_BASELINE_METRICS}
            for arr_key in ("curve_fin", "curve_arr", "on_dock", "waiting", "unloading"):
                lists = [x[arr_key] for x in have if x.get(arr_key)]
                if lists:
                    z[arr_key] = _mean_list(lists)
            z["hourly"] = [{f: _r(_mean([x["hourly"][h][f] for x in have if x.get("hourly") and x["hourly"][h].get(f) is not None]))
                            for f in ("arrivals", "finishes", "pallets_out")} for h in range(HOURS)]
            zones[key] = z
    out["zones"] = zones
    return out
