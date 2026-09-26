# -*- coding: utf-8 -*-
r"""
ops_v2.1_20260924 — 용인도시공사 관리 시설 9곳을 「위탁 시설(용인도시공사 운영)」으로 표시(2026-09-24). 앞 판 그대로 · 이미 있으면 멈춘다.
사용자: 「일단 위탁시설로 표시하고 남겨둬 보자. 데모 하고 용인시 담당자 의견 들어보지 뭐.」
  · 중대재해처벌법 제2조제9호나목 — 지방공기업의 장은 별도 경영책임자(09-06 결정: 분리 표시)
  · 그러나 소유가 용인시이고 운영만 위탁이면 같은 법 제9조제3항(도급·용역·위탁)으로 용인시장에게도 의무가 걸릴 수 있다 → 소유·위탁 관계 확인 전
칸 추가: consign(위탁 시설 표시) · consign_note(확인할 것). 관리 구분(mgmt_class)은 「위탁 시설(용인도시공사 운영)」.
"""
import csv, io, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
V = os.path.join(DEMO, "ops_v2.1_20260924", "seed")
if os.path.exists(os.path.dirname(V)):
    sys.exit("이미 있다 — 덮어쓰지 않는다")
with io.open(os.path.join(DEMO, "ops_v2.0_20260924", "seed", "asset.csv"), encoding="utf-8-sig") as f:
    r = csv.DictReader(f)
    cols, A = list(r.fieldnames), list(r)
cols += [c for c in ("consign", "consign_note") if c not in cols]
log = []
for a in A:
    a.setdefault("consign", "")
    a.setdefault("consign_note", "")
    if a.get("subject_tier") == "용인도시공사":
        old = a.get("mgmt_class", "")
        a["consign"] = "위탁(용인도시공사 운영)"
        a["consign_note"] = "소유(용인시 여부)·위탁 계약 확인 필요 — 용인시 소유·위탁이면 중대재해처벌법 제9조제3항으로 용인시장 의무도 걸림"
        a["mgmt_class"] = "위탁 시설(용인도시공사 운영)"
        log.append({"table": "asset", "key": a["asset_id"], "col": "mgmt_class", "old": old, "new": a["mgmt_class"], "why": "위탁 시설 표시(09-24 사용자)"})
os.makedirs(V)
with io.open(os.path.join(V, "asset.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(A)
with io.open(os.path.join(os.path.dirname(V), "_consign_log.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["table", "key", "col", "old", "new", "why"])
    w.writeheader()
    w.writerows(log)
print("위탁 표시", len(log), [l["key"] for l in log])
