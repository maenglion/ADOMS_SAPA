# -*- coding: utf-8 -*-
r"""
ops_v2.0_20260924 — 공공하수처리시설의 관리대상 유형 정정(2026-09-24). 앞 판 그대로 · 이미 있으면 멈춘다.
(판 이름을 v1.10 이 아니라 v2.0 으로 한 까닭: 앱은 판 폴더를 이름순으로 새것을 고르는데 「v1.10」은 「v1.9」보다 앞에 놓인다.)

발견(09-24 시연 시나리오 준비 중): 공공하수처리시설(레스피아) 17곳이 관리대상 유형 TG01 「상수도(정수장·관로)」에 연결돼 있었다.
  TG02 「하수·공공하수처리시설」(의무 204)에는 연결된 시설이 없었고, 시연 배정(유형마다 시설 3곳)이 TG01 의 첫 3곳 = 레스피아에 붙어
  **상수도 의무 207건씩이 하수처리장에** 걸려 있었다(원인: 데모 1차 생성의 「상하수도 → TG01」 규칙 · _build\build_ops_tables.py FMS_RULES).
바꾸는 것
  ① asset_target_map: 공공하수처리시설 TG01 → TG02 (TG25 는 그대로)
  ② 레스피아 3곳에 붙은 TG01 시설 배정 621 → 같은 순서의 지방상수도 3곳(상수도사업소 D04)으로 옮김
     부서 D05 → D04 · 정담당 SD04-1 · 부담당 SD04-2 · 과제 결재의 부서장 확인 H05 → H04 · 과제 완료자 SD05-* → SD04-*
바뀐 칸 → ops_v2.0_20260924\_fix_log.csv
"""
import csv, glob, io, os, sys
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
V = os.path.join(DEMO, "ops_v2.0_20260924"); OUT = os.path.join(V, "seed")


def latest(t):
    c = sorted(p for p in glob.glob(os.path.join(DEMO, "ops_v1.*", "seed", t + ".csv")) + glob.glob(os.path.join(DEMO, "ops_v0.*", "seed", t + ".csv")))
    c.sort(key=lambda p: [int(x) for x in os.path.basename(os.path.dirname(os.path.dirname(p))).split("_")[1][1:].split(".")])
    return c[-1]


def read(p):
    with io.open(p, encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        return list(r.fieldnames), list(r)


def write(t, cols, rows):
    with io.open(os.path.join(OUT, t + ".csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)


if os.path.exists(V):
    sys.exit("이미 있다 — 덮어쓰지 않는다: " + V)
log = []


def ch(t, k, c, o, n, why):
    log.append({"table": t, "key": k, "col": c, "old": o, "new": n, "why": why})


_, A = read(latest("asset"))
AB = {a["asset_id"]: a for a in A}
sewer = {a["asset_id"] for a in A if a["asset_kind"] == "공공하수처리시설"}
cm, M = read(latest("asset_target_map"))
for m in M:
    if m["asset_id"] in sewer and m["target_code"] == "TG01":
        ch("asset_target_map", m["asset_id"], "target_code", "TG01", "TG02", "① 하수처리시설 유형 정정")
        m["target_code"] = "TG02"
        m["basis"] = "공공하수처리시설 → 하수·공공하수처리시설(09-24 정정 · 전: 상수도)"
cd, D = read(latest("duty_assignment"))
src = sorted({d["asset_id"] for d in D if d["asset_id"] in sewer and d["target_code"] == "TG01"})
dst = sorted(a["asset_id"] for a in A if a["asset_kind"] == "지방상수도" and a.get("sapa_l2_result") != "제외")[:len(src)]
assert len(dst) == len(src), (src, dst)
mp = dict(zip(src, dst))
moved = set()
for d in D:
    if d["asset_id"] in mp and d["target_code"] == "TG01":
        new = {"asset_id": mp[d["asset_id"]], "dept_id": "D04", "owner_staff_id": "SD04-1", "deputy_staff_id": "SD04-2",
               "applicability_note": "시연 배정 정정 — 상수도 의무를 상수도 시설로(원래 %s)" % AB[d["asset_id"]]["asset_name"]}
        for k, v in new.items():
            if d[k] != v:
                ch("duty_assignment", d["assign_id"], k, d[k], v, "② 상수도 의무 → 상수도 시설")
                d[k] = v
        moved.add(d["assign_id"])
ct, T = read(latest("compliance_task"))
mt = set()
for t in T:
    if t["assign_id"] in moved:
        mt.add(t["task_id"])
        if t.get("done_by", "").startswith("SD05-"):
            nv = "SD04-" + t["done_by"].split("-")[1]
            ch("compliance_task", t["task_id"], "done_by", t["done_by"], nv, "②")
            t["done_by"] = nv
cp, P = read(latest("task_approval_patch"))
for p in P:
    if p["task_id"] in mt and p.get("head_ok_by") == "H05":
        ch("task_approval_patch", p["task_id"], "head_ok_by", "H05", "H04", "②")
        p["head_ok_by"] = "H04"
    for k in ("submitted_by",):
        if p["task_id"] in mt and p.get(k, "").startswith("SD05-"):
            nv = "SD04-" + p[k].split("-")[1]
            ch("task_approval_patch", p["task_id"], k, p[k], nv, "②")
            p[k] = nv
os.makedirs(OUT)
write("asset_target_map", cm, M)
write("duty_assignment", cd, D)
write("compliance_task", ct, T)
write("task_approval_patch", cp, P)
with io.open(os.path.join(V, "_fix_log.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["table", "key", "col", "old", "new", "why"])
    w.writeheader()
    w.writerows(log)
print("짝", {AB[s]["asset_name"]: AB[t]["asset_name"] for s, t in mp.items()})
print("유형 정정 %d · 옮긴 배정 %d · 과제 %d · 바뀐 칸 %d" % (sum(1 for l in log if l["why"].startswith("①")), len(moved), len(mt), len(log)))
