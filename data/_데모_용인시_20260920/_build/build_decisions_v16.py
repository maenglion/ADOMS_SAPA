# -*- coding: utf-8 -*-
"""
ops_v1.6_20260924 — 사용자 결정 반영(2026-09-24). 앞 판(ops_v1.5 등)은 그대로 둔다.

  ① 관리주체가 아닌 시설(판정 「제외」)에 걸려 「확인필요」였던 배정 243 → 「비해당」(사유 적음)
  ② 보육정책과 · 체육진흥과 · 자원순환과 — 누리집 목록에 없음 → 가상 부서로 포함(web_checked = 가상)
  ③ 저수지 4곳(기흥 · 이동 · 용담 · 두창) — 관리주체 한국농어촌공사로 확인
       기흥 · 이동 = 평택지사, 용담 · 두창 = 안성지사
       근거: 용인시민신문 2021-11-30 「수자원 향토주권 빼앗긴 용인시…80% 한국농어촌공사 관리」
             국제뉴스 2025-03-25 「용인시, 한국농어촌공사 평택·안성지사와 저수지 수질보전 협약」
       → 시설 판정 「제외」 · 그 시설 배정 「비해당」 · 그 시설 안전계획·매뉴얼 예시 기록은 새 판에서 뺀다(앞 판에 남음)
  ④ 새 부서로 의무 옮기기 — 하지 않음(나중에 판단)
모든 바뀐 칸은 _decision_log.csv 에 남긴다(되돌리기용).
"""
import csv, glob, io, os, sys
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
V = os.path.join(DEMO, "ops_v1.6_20260924"); OUT = os.path.join(V, "seed")
TODAY = "2026-09-24"; BY = "G01"   # 총괄 확인(안전정책관)
RES = {"DA2008-0000007": "평택지사", "DA2008-0000154": "평택지사", "DA2008-0000165": "안성지사", "DA2008-0000170": "안성지사"}
SRC_NOTE = "용인시민신문 2021-11-30 · 국제뉴스 2025-03-25"

def latest(t):
    c = sorted(p for p in glob.glob(os.path.join(DEMO, "ops_*", "seed", f"{t}.csv")) if "ops_v1.6" not in p)
    return c[-1]
def read(p):
    with io.open(p, encoding="utf-8-sig") as f:
        r = csv.DictReader(f); return list(r.fieldnames), list(r)
def write(t, cols, rows):
    p = os.path.join(OUT, f"{t}.csv")
    if os.path.exists(p): sys.exit("이미 있다 — 덮어쓰지 않는다: " + p)
    with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)

log = []
def ch(t, key, col, old, new, why): log.append({"table": t, "key": key, "col": col, "old": old, "new": new, "why": why})

# 시설
ca, A = read(latest("asset"))
excluded = set()
for a in A:
    if a["asset_id"] in RES:
        br = RES[a["asset_id"]]
        for col, new in (("sapa_l2_result", "제외"),
                         ("sapa_basis", f"관리주체 한국농어촌공사 {br} — 용인시는 관리주체 아님({SRC_NOTE})"),
                         ("need_data", ""), ("verified", "Y")):
            if a[col] != new: ch("asset", a["asset_id"], col, a[col], new, "③ 저수지 관리주체 확인"); a[col] = new
    if a.get("sapa_l2_result") == "제외": excluded.add(a["asset_id"])

# 배정
cd, D = read(latest("duty_assignment"))
n1 = n3 = 0
for d in D:
    why = None
    if d["asset_id"] in RES and d["applicability"] != "비해당":
        why = ("③", f"관리주체 한국농어촌공사 {RES[d['asset_id']]} — 용인시 관리 시설 아님({SRC_NOTE})"); n3 += 1
    elif d["asset_id"] in excluded and d["applicability"] == "확인필요":
        why = ("①", "관리주체 아님(시설 판정 「제외」) — 비해당으로 닫음(09-24 결정)"); n1 += 1
    if why:
        for col, new in (("applicability", "비해당"), ("applicability_note", why[1]), ("decided_by", BY), ("decided_at", TODAY)):
            if d[col] != new: ch("duty_assignment", d["assign_id"], col, d[col], new, why[0]); d[col] = new

# 부서
co, O = read(latest("org_dept"))
for o in O:
    if o["dept_id"] in ("D07", "D08", "D12") and o["web_checked"] != "가상":
        ch("org_dept", o["dept_id"], "web_checked", o["web_checked"], "가상", "② 가상 부서로 포함"); o["web_checked"] = "가상"

# 저수지에 붙은 예시 기록(안전계획 · 매뉴얼) — 새 판에서 뺀다
kept = {}
for t, key in (("civil_safety_plan", "plan_id"), ("civil_manual", "manual_id")):
    c, R = read(latest(t))
    out = []
    for r in R:
        if r.get("asset_id") in RES:
            ch(t, r[key], "(행)", r.get("facility_name") or r.get("asset_id"), "새 판에서 뺌", "③ 관리주체 아닌 시설의 예시 기록")
        else: out.append(r)
    kept[t] = (c, out, len(R) - len(out))

os.makedirs(OUT, exist_ok=True)
write("asset", ca, A); write("duty_assignment", cd, D); write("org_dept", co, O)
for t, (c, out, n) in kept.items(): write(t, c, out)
with io.open(os.path.join(V, "_decision_log.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["table", "key", "col", "old", "new", "why"]); w.writeheader(); w.writerows(log)
print(f"① 확인필요→비해당 {n1} · ③ 저수지 배정 비해당 {n3} · 뺀 기록 " + ", ".join(f"{t} {v[2]}" for t, v in kept.items()) + f" · 바뀐 칸 {len(log)}")
