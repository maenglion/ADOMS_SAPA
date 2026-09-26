# -*- coding: utf-8 -*-
r"""
ops_v2.0_20260924 보완 — 시설의 관리 근거 법령(mgmt_laws)을 v2.0 의 관리대상 연결로 다시 계산해 asset.csv 를 v2.0 판에 둔다(2026-09-24).
까닭: build_fix_sewer_v20.py 가 공공하수처리시설의 유형을 TG01 → TG02 로 바꿨는데, v1.9 에서 계산한 mgmt_laws 는 옛 유형(상수도) 기준이라
      구갈레스피아의 근거 법령이 「수도법 · …」으로 나왔다. 규칙은 build_scope_v19.py ⑤ 와 같다(그 시설 유형 의무의 법령, 의무 수 순 3개,
      중대재해처벌법·기관 공통 TG24·TG26 제외 · 저수지는 저수지·댐법 고정).
v2.0 판에 asset.csv 가 이미 있으면 멈춘다(덮어쓰지 않는다).
"""
import csv, glob, io, os, sys, collections as C
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
V = os.path.join(DEMO, "ops_v2.0_20260924", "seed")
OUT = os.path.join(V, "asset.csv")
if os.path.exists(OUT):
    sys.exit("이미 있다 — 덮어쓰지 않는다: " + OUT)


def read(p):
    with io.open(p, encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        return list(r.fieldnames), list(r)


ca, A = read(os.path.join(DEMO, "ops_v1.9_20260924", "seed", "asset.csv"))
_, M = read(os.path.join(V, "asset_target_map.csv"))
_, dc = read(sorted(glob.glob(os.path.join(DEMO, "ops_*", "seed", "duty_class.csv")))[-1])
laws = C.defaultdict(C.Counter)
for d in dc:
    if d["target_code"] in ("TG24", "TG26") or d["law"].startswith("중대재해 처벌"):
        continue
    laws[d["target_code"]][d["law"]] += 1
tg = C.defaultdict(set)
for m in M:
    tg[m["asset_id"]].add(m["target_code"])
changed = []
for a in A:
    if a["asset_id"].startswith("RS-YI-"):
        continue
    cnt = C.Counter()
    for t in tg[a["asset_id"]]:
        cnt.update(laws.get(t, {}))
    new = " · ".join(l for l, _ in cnt.most_common(3))
    if new != a.get("mgmt_laws", ""):
        changed.append((a["asset_name"], a.get("mgmt_laws", ""), new))
        a["mgmt_laws"] = new
with io.open(OUT, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=ca)
    w.writeheader()
    w.writerows(A)
with io.open(os.path.join(os.path.dirname(V), "_fix_log.csv"), "a", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    for n, o, nw in changed:
        w.writerow(["asset", n, "mgmt_laws", o, nw, "③ 근거 법령 다시 계산(유형 정정 뒤)"])
print("바뀐 시설", len(changed), changed[:3])
