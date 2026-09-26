# -*- coding: utf-8 -*-
r"""
ops_v1.7_20260924 — 관리주체(축1) 판정을 시설 표에 싣고 배정을 바로잡는다(2026-09-24). 앞 판은 그대로. 이미 있으면 멈춘다.

발단(사용자 09-24): 「대시보드 교량 459개소 — 용인시에 중처법 관리대상 다리가 저렇게 많아? 어디서 가져온 거야?」
  → 시설 표(asset)가 FMS 관할 구역 목록 1,026 전부이고, 09-06 에 이미 한 관리주체 판정(용인시 · 용인도시공사 · 타기관 · 확인필요)이
    앱 데이터에 실리지 않았다(메모리 adoms-subject-vs-target-2axis — 소재지 ≠ 관할, 관리주체를 관리대상보다 먼저).
원천(읽기만): 20_개발\개발내용 및 산출물\용인시\1차데모용\용인시 관리 시설\_FMS\통합판정_용인시시설물_전체_20260906.csv
             (FMS 공공데이터 API 관리주체 mngMbyNm + subject_rules.py 판정 · 09-06 사용자 결정 반영)
바꾸는 것
  ① asset 에 칸 추가: subject_tier · subject_name · subject_source(api/estimated/none) · subject_note
  ② 타기관 시설(관리주체가 한국도로공사·국토관리사무소·경기도·한국철도공사 등) → sapa_l2_result 「제외」(사유 적음)
     + 그 시설의 배정 「해당·확인필요」 → 「비해당」(사유: 관리주체 타기관) — 오늘 결정 ①과 같은 원칙
  ③ 관리주체 확인필요 시설(정보 없음 · 추정 불가) 과 「추정」으로 용인시가 된 시설 → 배정 「해당」 → 「확인필요」(사유 적음)
     ★ 저수지 4곳은 FMS 가 「(추정) 용인시」였으나 실제 한국농어촌공사 — 추정은 확정으로 쓰지 않는다
  ④ 그 시설에 붙은 예시 기록(안전계획·매뉴얼 등)은 건드리지 않는다 — 지울지는 사용자 결정 대기
모든 바뀐 칸 → ops_v1.7_20260924\_subject_log.csv
"""
import csv, glob, io, os, sys, collections as C
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(DEMO, "..", "..", "..", ".."))
SRC = os.path.join(ROOT, "20_개발", "개발내용 및 산출물", "용인시", "1차데모용", "용인시 관리 시설", "_FMS", "통합판정_용인시시설물_전체_20260906.csv")
V = os.path.join(DEMO, "ops_v1.7_20260924"); OUT = os.path.join(V, "seed")
TODAY, BY = "2026-09-24", "G01"
RES = {"DA2008-0000007", "DA2008-0000154", "DA2008-0000165", "DA2008-0000170"}   # 이미 v1.6 에서 한국농어촌공사로 확인
def latest(t):
    return sorted(p for p in glob.glob(os.path.join(DEMO, "ops_*", "seed", t + ".csv")) if "ops_v1.7" not in p)[-1]
def read(p):
    with io.open(p, encoding="utf-8-sig") as f:
        r = csv.DictReader(f); return list(r.fieldnames), list(r)
def write(t, cols, rows):
    p = os.path.join(OUT, t + ".csv")
    with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
if os.path.exists(V): sys.exit("이미 있다 — 덮어쓰지 않는다: " + V)
_, S = read(SRC); S = {x["facilNo"]: x for x in S}
ca, A = read(latest("asset")); cd, D = read(latest("duty_assignment"))
log = []
def ch(t, k, c, o, n, why): log.append({"table": t, "key": k, "col": c, "old": o, "new": n, "why": why})
add = ["subject_tier", "subject_name", "subject_source", "subject_note"]
ca = ca + [c for c in add if c not in ca]
tier = {}
for a in A:
    s = S.get(a["asset_id"], {})
    tr = s.get("subject_tier", "") or "확인필요"
    src = s.get("subject_source", "")
    if a["asset_id"] in RES:
        tr, name, src, note = "타기관", "한국농어촌공사", "web", "관리주체 한국농어촌공사(용인시민신문 2021-11-30 · 국제뉴스 2025-03-25) — FMS 는 「(추정) 용인시」"
    else:
        name, note = s.get("subject_name", "") or s.get("mngMbyNm", ""), s.get("subject_note", "")
        if tr == "용인시" and src == "estimated":
            tr, note = "확인필요", "용인시로 추정(이름) — 관리주체 확인 필요 · " + note
    a.update({"subject_tier": tr, "subject_name": name, "subject_source": src, "subject_note": note})
    tier[a["asset_id"]] = (tr, name)
    if tr == "타기관" and a.get("sapa_l2_result") != "제외":
        nb = "관리주체 타기관(%s) — 용인시 관리 시설 아님 · %s" % (name or "관리기관", a.get("sapa_basis", ""))
        ch("asset", a["asset_id"], "sapa_l2_result", a["sapa_l2_result"], "제외", "② 관리주체 타기관"); a["sapa_l2_result"] = "제외"
        ch("asset", a["asset_id"], "sapa_basis", a["sapa_basis"], nb, "② 관리주체 타기관"); a["sapa_basis"] = nb
n2 = n3 = 0
for d in D:
    tr, name = tier.get(d["asset_id"], ("", ""))
    if not d["asset_id"] or not tr: continue
    if tr == "타기관" and d["applicability"] != "비해당":
        new = {"applicability": "비해당", "applicability_note": "관리주체 타기관(%s) — 용인시 관리 시설 아님(FMS 관리주체 · 09-24)" % (name or "관리기관"),
               "decided_by": BY, "decided_at": TODAY}; why = "② 타기관"; n2 += 1
    elif tr == "확인필요" and d["applicability"] == "해당":
        new = {"applicability": "확인필요", "applicability_note": "관리주체 확인 필요(FMS 관리주체 정보 없음·추정) — 용인시 관리면 「해당」으로"}; why = "③ 관리주체 확인필요"; n3 += 1
    else:
        continue
    for k, v in new.items():
        if d.get(k, "") != v: ch("duty_assignment", d["assign_id"], k, d.get(k, ""), v, why); d[k] = v
os.makedirs(OUT)
write("asset", ca, A); write("duty_assignment", cd, D)
with io.open(os.path.join(V, "_subject_log.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["table", "key", "col", "old", "new", "why"]); w.writeheader(); w.writerows(log)
print("시설", C.Counter(v[0] for v in tier.values()))
print("교량", C.Counter(tier[a["asset_id"]][0] for a in A if a["asset_gbn"] == "교량"))
print("배정 타기관→비해당 %d · 확인필요로 %d · 바뀐 칸 %d" % (n2, n3, len(log)))
