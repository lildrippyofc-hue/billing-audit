"""Rebuild the Projected Finish model constants from recent DMS shifts (read-only).

The portal's projected finish (PORTAL_FINISH_MODEL in index.html) simulates the rest of the
night from how trucks really behaved over recent shifts: how early/late they check in
relative to their appointment, how long an unload takes, and how many doors run at once.
Run this every month or two and paste the printed object over PORTAL_FINISH_MODEL.

    py build_finish_model.py [days]      # default: last 14 completed business dates

Uses the same DMS sessions as the app (dms_config.json / dms_mn_config.json or env vars).
"""
import json
import statistics as st
import sys
from datetime import datetime, timedelta, timezone

import main

DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 14
MIN = 60000.0


def to_ms(iso):
    if not iso:
        return None
    d = datetime.fromisoformat(iso)
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.timestamp() * 1000


def pull_day(session, info):
    payload = {"info": info, "loc": session["loc"], "userinfo": session["userinfo"], "buck": session.get("buck") or {}}
    loads = [x for x in main._first_list(main._dms_json_request("api/load/getloaddetails", payload, session["config"])) if isinstance(x, dict)]
    stamps = [x for x in main._first_list(main._dms_json_request("api/stamp/getStamps", payload, session["config"])) if isinstance(x, dict)]
    return main._merge_dms_portal_rows(loads, stamps)


def percentiles(values):
    values = sorted(values)
    table = [round(values[min(len(values) - 1, int(len(values) * p / 100))]) for p in range(101)]
    # Trim the single most extreme value at each end (a truck stuck in the yard for a
    # day, a stamp entered hours late): interpolating up to it would let one freak
    # outlier drag every simulated night's last trucks out by hours.
    table[0], table[100] = table[1], table[99]
    return table


def build(session_fn):
    session = session_fn()
    today = datetime.now(main.DMS_BUSINESS_TZ)
    scheduled = arrived = 0
    offsets, service, peaks = [], [], []
    for back in range(1, DAYS + 1):
        d = today - timedelta(days=back)
        trucks = pull_day(session, f"{d.month}/{d.day}/{d.year}")
        rows = []
        for t in trucks:
            appt, ci, us = to_ms(t["appointmentIso"]), to_ms(t["checkInIso"]), to_ms(t["unloadStartIso"])
            uf = to_ms(t["unloadFinishIso"] or t["receivingFinishIso"])
            if appt:
                scheduled += 1
                if ci:
                    arrived += 1
                    offsets.append((ci - appt) / MIN)
            if ci and us and uf and uf >= us:
                service.append((uf - us) / MIN)
                rows.append((us, uf))
        events = sorted([(us, 1) for us, _ in rows] + [(uf, -1) for _, uf in rows])
        live = peak = 0
        for _, delta in events:
            live += delta
            peak = max(peak, live)
        peaks.append(peak)
    return {
        "fmax": round(arrived / scheduled, 3),
        "offsets": percentiles(offsets),
        "service": percentiles(service),
        "peak": round(st.median(peaks)),
    }


if __name__ == "__main__":
    model = {"oks": build(lambda: main._ensure_dms_session()), "mn": build(lambda: main._ensure_dms_mn_session())}
    print("const PORTAL_FINISH_MODEL = " + json.dumps(model, separators=(",", ":")) + ";")
