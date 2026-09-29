"""Rebuild PALLET_BREAKDOWN_MODEL in index.html from recent DMS stamp history (read-only).

The Truck Report's "Projected Breakdowns Tonight" section needs to know, on average, how
many pallets a breakdown adds once it happens. That figure comes from here: DMS stamp
comments already carry it as a code like "9c" or "14 C" (created/breakdown pallets),
written in by clerks during the shift. This scans recent shifts for that code, per dock
area, so the projection is a measured average instead of a guess.

    py build_breakdown_model.py [days]      # default: last 14 completed business dates

Uses the same DMS sessions as the app (dms_config.json / dms_mn_config.json or env vars).
Paste the printed object over PALLET_BREAKDOWN_MODEL in index.html; rerun every month or
two as conditions change.
"""
import json
import re
import statistics as st
import sys
from datetime import datetime, timedelta

import main

DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 14
MIN_AREA_SAMPLE = 15   # below this, an area's own average is too noisy to trust on its own
CODE_PATTERN = re.compile(r"(?:^|[^a-zA-Z0-9])(\d+)\s*[cC](?=$|[^a-zA-Z])")

# Folds known spelling/abbreviation variants of the same physical area into one bucket.
# Matched against the Truck Report's own dock-type text with the same normalizer at
# runtime (see normalizeDockTypeKey in index.html) so "Std. Trailer Freezer" and DMS's
# "FRZ" land on the same key.
AREA_SYNONYMS = {"frz": "freezer", "chl": "chill"}


def normalize_area_key(value):
    text = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
    text = re.sub(r"\bstd\.?\s*trailer\b", "", text).strip()
    return AREA_SYNONYMS.get(text, text)


def extract_created_pallets(comment):
    return [int(m.group(1)) for m in CODE_PATTERN.finditer(str(comment or ""))]


def build(session_fn):
    session = session_fn()
    today = datetime.now(main.DMS_BUSINESS_TZ)
    magnitudes = []               # every breakdown event's pallet count, for the global average
    by_area = {}                  # normalized area -> [magnitudes]
    for back in range(1, DAYS + 1):
        d = today - timedelta(days=back)
        info = f"{d.month}/{d.day}/{d.year}"
        payload = {"info": info, "loc": session["loc"], "userinfo": session["userinfo"], "buck": session.get("buck") or {}}
        loads = [x for x in main._first_list(main._dms_json_request("api/load/getloaddetails", payload, session["config"])) if isinstance(x, dict)]
        stamps = [x for x in main._first_list(main._dms_json_request("api/stamp/getStamps", payload, session["config"])) if isinstance(x, dict)]
        area_by_rowid = {l.get("rowid"): l.get("area") for l in loads if l.get("rowid") is not None}
        for s in stamps:
            codes = extract_created_pallets(s.get("comments"))
            if not codes:
                continue
            total = sum(codes)
            magnitudes.append(total)
            area = normalize_area_key(area_by_rowid.get(s.get("rowid")) or s.get("area"))
            if area:
                by_area.setdefault(area, []).append(total)
    by_area_avg = {area: round(st.mean(vals), 1) for area, vals in by_area.items() if len(vals) >= MIN_AREA_SAMPLE}
    return {
        "global": round(st.mean(magnitudes), 1) if magnitudes else 0,
        "byArea": by_area_avg,
        "sample": len(magnitudes),
    }


if __name__ == "__main__":
    model = {"oks": build(lambda: main._ensure_dms_session()), "mn": build(lambda: main._ensure_dms_mn_session())}
    print("const PALLET_BREAKDOWN_MODEL = " + json.dumps(model, separators=(",", ":")) + ";")
