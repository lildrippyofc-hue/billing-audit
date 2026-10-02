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
"""
import json
import re
import statistics as st
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import openpyxl

TZ = ZoneInfo("America/Chicago")
MIN = 60000.0
STEP_MIN = 15
STEPS = 14 * 60 // STEP_MIN          # 7 PM through 9 AM
CHECKPOINTS = [240, 300, 360, 420, 480, 540]   # minutes after the 7 PM start: 11 PM .. 4 AM
ZONES = [
    ("freezer", ["frz", "freezer"]),
    ("chilled", ["chl", "chill", "cooler", "eggs", "egg", "fresh meat", "meat", "produce"]),
    ("dry", ["dry", "amb", "ambient", "slip sheet", "slip", "floor loaded", "floor load", "floor"]),
]


def zone_of(area):
    text = re.sub(r"[^a-z0-9]+", " ", str(area or "").lower()).strip()
    for name, keys in ZONES:
        if text in keys:
            return name
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


def load_nights(path):
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
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    doors = int(sys.argv[sys.argv.index("--doors") + 1]) if "--doors" in sys.argv else 6
    if "--doors" in sys.argv:
        args = [a for a in args if a != str(doors)]
    if not args:
        sys.exit(__doc__)
    model = build(args[0], doors, keep_last="--keep-last" in sys.argv)
    print("// built from %d nights" % model["nights"], file=sys.stderr)
    print("const PORTAL_ZONE_MODEL = " + json.dumps(model, separators=(",", ":")) + ";")
