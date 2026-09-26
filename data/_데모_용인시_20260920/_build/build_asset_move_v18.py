# -*- coding: utf-8 -*-
r"""
ops_v1.8_20260924 · us_v1.3_20260924 — 시연 배정을 용인시 관리 시설로 옮기고, 상하수도 관리주체를 확정한다(2026-09-24). 앞 판 그대로 · 이미 있으면 멈춘다.

사용자 결정(09-24): 「관리주체가 확정된 용인시 시설 134곳에 시설 단위 배정이 없다 → 용인시 시설로 옮겨줘」
  ① 상하수도 관리주체 확정(추정 아님 — 근거 있음)
     · 공공하수처리시설 17: 하수도법 제2조 「공공하수도」 = 지방자치단체가 설치·관리 · 용인시 상하수도사업소 누리집 「레스피아 현황」
       (용인·기흥·구갈·수지·영덕 레스피아 — 하수운영과)
     · 지방상수도 11: 수도법 제3조 「지방상수도」 = 지방자치단체가 관할 지역 주민에게 공급 · 용인시 상수도사업소
     → subject_tier 용인시(source law·web) · v1.7 에서 「확인필요」로 내린 배정 가운데 v1.6 에 「해당」이던 것은 「해당」으로 되돌림
  ② 시연 배정이 몰린 시설 → 같은 유형·같은 부서의 용인시 시설로 통째로(배정 번호·과제·증빙·결재는 그대로 — 배정의 asset_id 만 바뀜)
     학교 3 → 용인시 건물 · 교량 3 → 용인시 교량(같은 종 우선) · 옹벽 3 → 용인시 옹벽
     저수지 3(한국농어촌공사) · 배수통문 3(관리주체 모름)은 짝이 없어 그대로
     옮긴 배정은 「해당」(사유: 시연 배정을 용인시 관리 시설로 옮김)
  ③ 옮긴 시설에 딸린 기록(안전계획·매뉴얼·위험신고·재해·명령·도급·기관장 활동 · us 기본정보·시기)도 같은 짝으로 — 시설 번호와 이름만 바꾼다.
     옮길 자리에 같은 연도 안전계획이 이미 있으면 옮기지 않는다(겹침 방지 · 기록에 남김).
바뀐 칸 전부 → ops_v1.8_20260924\_move_log.csv
"""
import csv, glob, io, json, os, sys, collections as C
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
V = os.path.join(DEMO, "ops_v1.8_20260924"); OUT = os.path.join(V, "seed")
VU = os.path.join(DEMO, "us_v1.3_20260924"); OUTU = os.path.join(VU, "seed")
TODAY = "2026-09-24"
WEB5 = {"용인레스피아", "기흥레스피아", "구갈레스피아", "수지레스피아", "영덕레스피아"}
def latest(t, pre="ops_"):
    c = sorted(p for p in glob.glob(os.path.join(DEMO, pre + "*", "seed", t + ".csv")) if "v1.8" not in p and "us_v1.3" not in p)
    return c[-1] if c else None
def read(p):
    with io.open(p, encoding="utf-8-sig") as f:
        r = csv.DictReader(f); return list(r.fieldnames), list(r)
def write(d, t, cols, rows):
    with io.open(os.path.join(d, t + ".csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
if os.path.exists(V) or os.path.exists(VU): sys.exit("이미 있다 — 덮어쓰지 않는다")
log = []
def ch(t, k, c, o, n, why): log.append({"table": t, "key": k, "col": c, "old": o, "new": n, "why": why})

ca, A = read(latest("asset")); AB = {a["asset_id"]: a for a in A}
# ① 상하수도 관리주체
for a in A:
    if a["asset_gbn"] != "상하수도" or a["subject_tier"] == "용인시": continue
    if a["asset_kind"] == "공공하수처리시설":
        src, note = ("web", "용인시 상하수도사업소 누리집 「레스피아 현황」(하수운영과) · 하수도법 공공하수도") if a["asset_name"] in WEB5 else \
                    ("law", "하수도법 제2조 공공하수도(지방자치단체가 설치·관리) — 용인시 하수도사업소")
        name = "용인시 하수도사업소"
    elif a["asset_kind"] == "지방상수도":
        src, note, name = "law", "수도법 제3조 지방상수도(지방자치단체가 주민에게 공급) — 용인시 상수도사업소", "용인시 상수도사업소"
    else:
        continue
    for k, v in (("subject_tier", "용인시"), ("subject_name", name), ("subject_source", src), ("subject_note", note)):
        ch("asset", a["asset_id"], k, a[k], v, "① 상하수도 관리주체"); a[k] = v

cd, D = read(latest("duty_assignment"))
_, D16 = read(os.path.join(DEMO, "ops_v1.6_20260924", "seed", "duty_assignment.csv")); prev = {d["assign_id"]: d for d in D16}
# ② 짝 정하기 — 배정이 몰린 시설(용인시 아님) → 같은 구분·같은 부서의 용인시 시설(제외 아님), 같은 종 우선, 번호 순
src_assets = sorted({d["asset_id"] for d in D if d["asset_id"] and AB[d["asset_id"]]["subject_tier"] != "용인시"})
used, move = set(), {}
for s in src_assets:
    a = AB[s]
    pool = [b for b in A if b["asset_gbn"] == a["asset_gbn"] and b["dept_id"] == a["dept_id"] and b["subject_tier"] == "용인시"
            and b["sapa_l2_result"] != "제외" and b["asset_id"] not in used]
    if not pool: continue
    pool.sort(key=lambda b: (b["asset_class"] != a["asset_class"], b["asset_kind"] != a["asset_kind"], b["asset_id"]))
    move[s] = pool[0]["asset_id"]; used.add(pool[0]["asset_id"])
nm, nr = 0, 0
for d in D:
    a = d["asset_id"]
    if a in move:
        new = {"asset_id": move[a], "applicability": "해당",
               "applicability_note": "시연 배정을 용인시 관리 시설로 옮김(원래 %s — 관리주체 %s)" % (AB[a]["asset_name"], AB[a]["subject_name"] or AB[a]["subject_tier"]),
               "decided_by": "", "decided_at": ""}
        for k, v in new.items():
            if d[k] != v: ch("duty_assignment", d["assign_id"], k, d[k], v, "② 시설 옮김")
            d[k] = v
        nm += 1
    elif a and AB.get(a, {}).get("subject_tier") == "용인시" and d["applicability"] == "확인필요" and prev.get(d["assign_id"], {}).get("applicability") == "해당":
        for k, v in (("applicability", "해당"), ("applicability_note", ""), ("decided_by", ""), ("decided_at", "")):
            if d[k] != v: ch("duty_assignment", d["assign_id"], k, d[k], v, "① 관리주체 확정 — 되돌림")
            d[k] = v
        nr += 1

# ③ 옮긴 시설에 딸린 기록
def swap(row):
    changed = False
    for k, v in list(row.items()):
        if not isinstance(v, str) or not v: continue
        n = v
        for s, t in move.items():
            if s in n: n = n.replace(s, t)
            on, tn = AB[s]["asset_name"], AB[t]["asset_name"]
            if on and on in n: n = n.replace(on, tn)
        if k in ("asset_gbn", "asset_kind", "asset_class"): continue
        if n != v: row[k] = n; changed = True
    return changed
os.makedirs(OUT); os.makedirs(OUTU)
recs = C.Counter(); skipped = []
for t in ("civil_safety_plan", "civil_manual", "hazard_report", "incident", "order_received", "contract", "ceo_activity", "drill_plan"):
    p = latest(t)
    if not p: continue
    cols, R = read(p)
    have = {(r.get("asset_id"), r.get("plan_year", "")) for r in R}
    touched = False
    for r in R:
        aid = r.get("asset_id", "")
        if t in ("civil_safety_plan", "civil_manual") and aid in move and (move[aid], r.get("plan_year", "")) in have:
            skipped.append((t, r.get("plan_id") or r.get("manual_id"), AB[aid]["asset_name"])); continue
        before = dict(r)
        if swap(r):
            touched = True; recs[t] += 1
            for k in r:
                if r[k] != before[k]: ch(t, next(iter(before.values())), k, before[k], r[k], "③ 기록 따라 옮김")
            if "asset_class" in r and aid in move: r["asset_class"] = AB[move[aid]]["asset_class"]
            if "asset_kind" in r and aid in move: r["asset_kind"] = AB[move[aid]]["asset_kind"]
    if touched: write(OUT, t, cols, R)
for t in ("usb1_basic", "usb2_timing", "usc_record", "usd_record"):
    p = latest(t, "us_")
    if not p: continue
    cols, R = read(p); touched = False
    for r in R:
        before = dict(r)
        if swap(r):
            touched = True; recs["us:" + t] += 1
            for k in r:
                if r[k] != before[k]: ch("us:" + t, next(iter(before.values())), k, before[k][:200], r[k][:200], "③ 기록 따라 옮김")
    if touched: write(OUTU, t, cols, R)
write(OUT, "asset", ca, A); write(OUT, "duty_assignment", cd, D)
with io.open(os.path.join(V, "_move_log.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["table", "key", "col", "old", "new", "why"]); w.writeheader(); w.writerows(log)
with io.open(os.path.join(V, "_move_map.json"), "w", encoding="utf-8") as f:
    json.dump({s: {"to": t, "from_name": AB[s]["asset_name"], "to_name": AB[t]["asset_name"]} for s, t in move.items()}, f, ensure_ascii=False, indent=1)
if not os.listdir(OUTU): os.rmdir(OUTU); os.rmdir(VU)
print("짝", {AB[s]["asset_name"]: AB[t]["asset_name"] for s, t in move.items()})
print("옮긴 배정 %d · 되돌린 배정 %d · 옮긴 기록 %s · 겹쳐서 안 옮김 %d · 바뀐 칸 %d" % (nm, nr, dict(recs), len(skipped), len(log)))
print(C.Counter(a["subject_tier"] for a in A))
