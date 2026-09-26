# -*- coding: utf-8 -*-
"""/system/record 입력 시험에서 넣은 줄만 덮개에서 뺀다(다른 사람이 넣은 것은 그대로)."""
import json, io, sys

P = r"C:\1.업무\7.ADOMS 구현\20_개발\_데모_용인시_20260920\04_앱\adoms2\.data\overlay.json"
BK = r"C:\1.업무\7.ADOMS 구현\30_데이터\_수집작업\ADOMS_DB_v1\_데모_용인시_20260920\_build\_tmp_sys\overlay_backup.json"
VOC = "VOC-MUAZM4EFUC"
SYR = {"SYR-MUAZN1E7V6", "SYR-MUAZMUAB9F"}
o = json.load(io.open(P, encoding="utf-8"))
bk = json.load(io.open(BK, encoding="utf-8"))

t = o.get("tables", {})
t["worker_voice"] = [r for r in t.get("worker_voice", []) if r.get("voice_id") != VOC]
t["system_record"] = [r for r in t.get("system_record", []) if r.get("record_id") not in SYR]
for k in ["worker_voice", "system_record"]:
    if not t[k] and k not in bk.get("tables", {}):
        del t[k]

p = o.get("patches", {})
bp = bk.get("patches", {})
for tbl, key in [("worker_voice", VOC), ("safety_org_role", "SOR-044"), ("safety_manual", "MAN-003")]:
    if tbl in p and key in p[tbl] and key not in bp.get(tbl, {}):
        del p[tbl][key]
    if tbl in p and not p[tbl] and tbl not in bp:
        del p[tbl]
if not p and "patches" not in bk:
    o.pop("patches", None)

mine = {"worker_voice:" + VOC, "safety_org_role:SOR-044", "safety_manual:MAN-003"} | {"system_record:" + s for s in SYR}
before = len(o["log"])
o["log"] = [l for l in o["log"] if not (l.get("target") in mine and l.get("at", "") >= "2026-09-21T08:30")]
print("log removed", before - len(o["log"]))
io.open(P, "w", encoding="utf-8").write(json.dumps(o, ensure_ascii=False, indent=2))
print("tables", list(o.get("tables", {}).keys()), "patches", list(o.get("patches", {}).keys()) if "patches" in o else None)
