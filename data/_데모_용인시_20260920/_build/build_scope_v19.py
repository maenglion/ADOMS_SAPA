# -*- coding: utf-8 -*-
r"""
ops_v1.9_20260924 · us_v1.4_20260924 — 일요일 시연 버전의 시설 범위 정리 + 용인시 관리 저수지 · 농업기반팀(2026-09-24). 앞 판 그대로 · 이미 있으면 멈춘다.

사용자 결정(09-24)
  ① 다른 기관 시설(관리주체 타기관 173)은 모두 제외 ② 관리주체 확인 필요 시설(682 — 대시보드 「확인 필요 468개소」)도 일단 제외
     → 새 판의 시설 표에서 빼고, 딸린 배정·과제·결재·증빙·점검·알림·기록·관리대상 연결도 뺀다(앞 판에는 남는다 · 목록 _removed_*.csv)
  ③ 용인시 관리 저수지 48곳을 관리대상 시설로 — 중대재해처벌법 관리대상 아님(시행령 별표 3 댐 기준 미만) → 「관계법령 관리시설」,
     근거 법령 = 저수지ㆍ댐의 안전관리 및 재해예방에 관한 법률. 관리대상 유형 TG04(댐·저수지)에 잇는다.
     원천: 20_개발\…\01_설계\v2_추가화면_20260924\(조사)용인시_관리저수지_20260924.md (공공데이터포털 「경기도 용인시 저수지 현황」 2014-12·2016-07 판)
  ④ 농업기반팀 추가 — D23 · 농림축산국 농업정책과 농업기반팀(누리집 업무안내: 농업기반시설 유지관리(저수지)·재해위험 저수지 정비). 실무자 2 · 부서장 1(가상 이름)
     댐·저수지(TG04) 유형 배정의 담당을 재난대응담당관(D13) → 농업기반팀(D23)으로(과제 결재의 부서장 확인도 H13 → H23)
  ⑤ 모든 시설에 칸 추가: mgmt_class(중처법 공중이용시설 / 관계법령 관리시설) · mgmt_laws(관리 근거 법령 — 그 시설 유형에 걸린 의무의 법령,
     의무 수 순 3개, 중대재해처벌법·기관 공통 유형 TG24·TG26 제외)
바뀐 칸 → ops_v1.9_20260924\_scope_log.csv · 뺀 행 → _removed_<표>.csv
"""
import csv, glob, io, os, re, sys, collections as C
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(DEMO, "..", "..", "..", ".."))
RES_MD = os.path.join(ROOT, "20_개발", "_데모_용인시_20260920", "01_설계", "v2_추가화면_20260924", "(조사)용인시_관리저수지_20260924.md")
V = os.path.join(DEMO, "ops_v1.9_20260924"); OUT = os.path.join(V, "seed")
VU = os.path.join(DEMO, "us_v1.4_20260924"); OUTU = os.path.join(VU, "seed")
LAW_RES = "저수지ㆍ댐의 안전관리 및 재해예방에 관한 법률"


def latest(t, pre="ops_"):
    c = sorted(p for p in glob.glob(os.path.join(DEMO, pre + "*", "seed", t + ".csv")) if "ops_v1.9" not in p and "us_v1.4" not in p)
    return c[-1] if c else None


def read(p):
    with io.open(p, encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        return list(r.fieldnames), list(r)


def write(d, t, cols, rows):
    with io.open(os.path.join(d, t + ".csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


if os.path.exists(V) or os.path.exists(VU):
    sys.exit("이미 있다 — 덮어쓰지 않는다")
os.makedirs(OUT)
os.makedirs(OUTU)
log = []


def ch(t, k, c, o, n, why):
    log.append({"table": t, "key": k, "col": c, "old": o, "new": n, "why": why})


# ── ①② 뺄 시설과 딸린 것
ca, A = read(latest("asset"))
rm = {a["asset_id"] for a in A if a.get("subject_tier") in ("타기관", "확인필요")}
cd, D = read(latest("duty_assignment"))
rm_asg = {d["assign_id"] for d in D if d["asset_id"] in rm}
ct, T = read(latest("compliance_task"))
rm_task = {t["task_id"] for t in T if t["assign_id"] in rm_asg}
removed = C.Counter()


def drop(t, pre, pred, outdir):
    p = latest(t, pre)
    if not p:
        return
    cols, R = read(p)
    keep, gone = [], []
    for r in R:
        (gone if pred(r) else keep).append(r)
    if gone:
        write(outdir, t, cols, keep)
        write(V, "_removed_" + t, cols, gone)
        removed[t] += len(gone)


byasset = lambda r: r.get("asset_id", "") in rm or r.get("target_id", "") in rm
for t in ("asset_target_map", "civil_manual", "civil_safety_plan", "contract", "hazard_report", "incident", "order_received", "ceo_activity", "drill_plan"):
    drop(t, "ops_", byasset, OUT)
for t in ("evidence", "inspection", "notification", "task_approval_patch"):
    drop(t, "ops_", lambda r: r.get("task_id", "") in rm_task, OUT)
for t in ("usb1_basic", "usb2_timing", "usc_record", "usd_record", "use_record"):
    drop(t, "us_", byasset, OUTU)
gone_t = [t for t in T if t["task_id"] in rm_task]
gone_d = [d for d in D if d["assign_id"] in rm_asg]
gone_a = [a for a in A if a["asset_id"] in rm]
write(V, "_removed_compliance_task", ct, gone_t)
write(V, "_removed_duty_assignment", cd, gone_d)
write(V, "_removed_asset", ca, gone_a)
T = [t for t in T if t["task_id"] not in rm_task]
D = [d for d in D if d["assign_id"] not in rm_asg]
A = [a for a in A if a["asset_id"] not in rm]
removed.update({"compliance_task": len(gone_t), "duty_assignment": len(gone_d), "asset": len(gone_a)})

# ── ④ 농업기반팀
co, O = read(latest("org_dept"))
cs, S = read(latest("staff"))
if not any(o["dept_id"] == "D23" for o in O):
    O.append({"dept_id": "D23", "dept_name": "농업기반팀", "dept_role": "현업", "parent_dept_id": "D02",
              "org_path": "제1부시장 › 농림축산국 › 농업정책과 › 농업기반팀", "unit_kind": "팀",
              "duties": "농업기반시설 유지관리(저수지 48곳) · 재해위험 저수지 정비사업 · 저수지·댐 안전점검",
              "related_note": "저수지 비상대처계획·주민대피지구는 재난대응담당관과 유관(대피 · 재난 대응)", "web_checked": "Y"})
    used = {s["display_name"].split()[0] for s in S}
    pool = [n for n in ("한지우", "배서진", "노경민", "구하은", "석민재", "추예린") if n not in used]
    for sid, nm, role, pos, lv in (("SD23-1", pool[0], "정담당", "주무관", "1"), ("SD23-2", pool[1], "부담당", "주무관", "1"),
                                   ("H23", pool[2], "부서장", "농업정책과장", "2")):
        S.append({"staff_id": sid, "display_name": "%s %s" % (nm, pos), "dept_id": "D23", "duty_role": role, "position": pos,
                  "approval_level": lv, "email": "d23.%s@demo.yongin.go.kr" % sid.lower(), "phone": "", "note": "가상 인물"})
    ch("org_dept", "D23", "(행)", "", "농업기반팀", "④ 부서 추가")

moved_asg = set()
for d in D:
    if d["target_code"] == "TG04" and d["dept_id"] == "D13":
        for k, v in (("dept_id", "D23"), ("owner_staff_id", "SD23-1"), ("deputy_staff_id", "SD23-2")):
            ch("duty_assignment", d["assign_id"], k, d[k], v, "④ 저수지 담당 = 농업기반팀")
            d[k] = v
        moved_asg.add(d["assign_id"])
mv_task = {t["task_id"] for t in T if t["assign_id"] in moved_asg}
pp = os.path.join(OUT, "task_approval_patch.csv")
cp, P = read(pp if os.path.exists(pp) else latest("task_approval_patch"))
for p in P:
    if p["task_id"] in mv_task and p.get("head_ok_by") == "H13":
        ch("task_approval_patch", p["task_id"], "head_ok_by", "H13", "H23", "④")
        p["head_ok_by"] = "H23"
write(OUT, "task_approval_patch", cp, P)
for t in T:
    if t["task_id"] in mv_task and t.get("done_by") in ("SD13-1", "SD13-2"):
        nv = t["done_by"].replace("SD13", "SD23")
        ch("compliance_task", t["task_id"], "done_by", t["done_by"], nv, "④")
        t["done_by"] = nv

# ── ③ 저수지 48
rows = []
for line in io.open(RES_MD, encoding="utf-8"):
    if not re.match(r"^\|\s*\d+\s*\|", line):
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    if len(c) < 10 or not c[1].endswith("저수지"):
        continue
    rows.append(c)
assert len(rows) == 48, len(rows)
add = ["mgmt_class", "mgmt_laws", "res_storage_k", "res_dam_height", "res_emergency_plan"]
ca = ca + [x for x in add if x not in ca]
cm, M = read(os.path.join(OUT, "asset_target_map.csv"))
for c in rows:
    no, nm, loc, stor, h, per, judge = c[0], c[1], c[2], c[3], c[4], c[6], c[9]
    ep = "대상" if "비상대처 **○**" in judge or "비상대처 ○" in judge else ("경계" if "경계" in judge else "")
    aid = "RS-YI-%04d" % int(no)
    A.append({"asset_id": aid, "asset_name": nm, "asset_gbn": "저수지", "asset_kind": "농업용 저수지(흙댐)", "asset_class": "",
              "safety_grade": "", "completed_ymd": (re.findall(r"\d{4}", per) or [""])[-1], "addr": "경기도 용인시 " + loc, "dept_id": "D23",
              "source": "공공데이터(경기도 용인시 저수지 현황 2016-07)", "sapa_l2_result": "제외",
              "sapa_basis": "중대재해처벌법 관리대상 아님 — 시행령 별표 3 댐 기준(총저수용량 1천만 톤 이상 용수전용댐 등) 미만 · 관계법령 관리시설",
              "need_data": "", "verified": "Y", "subject_tier": "용인시", "subject_name": "용인시 농업정책과(농업기반팀)", "subject_source": "web",
              "subject_note": "공공데이터포털 「경기도 용인시 저수지 현황」 · 용인시청 업무안내(농업기반시설 유지관리)",
              "mgmt_class": "관계법령 관리시설", "mgmt_laws": LAW_RES, "res_storage_k": stor, "res_dam_height": h, "res_emergency_plan": ep})
    M.append({"asset_id": aid, "target_code": "TG04", "basis": "저수지·댐법 관리 저수지(공공데이터 · 용인시 관리)", "confidence": "high"})
    ch("asset", aid, "(행)", "", nm, "③ 저수지 추가")
write(OUT, "asset_target_map", cm, M)

# ── ⑤ 관리 근거 법령
_, dc = read(latest("duty_class"))
laws_by_tg = C.defaultdict(C.Counter)
for d in dc:
    if d["target_code"] in ("TG24", "TG26") or d["law"].startswith("중대재해 처벌"):
        continue
    laws_by_tg[d["target_code"]][d["law"]] += 1
tg_of = C.defaultdict(set)
for m in M:
    tg_of[m["asset_id"]].add(m["target_code"])
for a in A:
    if a["asset_gbn"] == "저수지" and a["asset_id"].startswith("RS-YI-"):
        continue
    cnt = C.Counter()
    for tg in tg_of[a["asset_id"]]:
        cnt.update(laws_by_tg.get(tg, {}))
    a["mgmt_laws"] = " · ".join(l for l, _ in cnt.most_common(3))
    a["mgmt_class"] = "중처법 공중이용시설" if a.get("sapa_l2_result") in ("해당", "검토필요") else "관계법령 관리시설"
for t, cols, R in (("asset", ca, A), ("duty_assignment", cd, D), ("compliance_task", ct, T), ("org_dept", co, O), ("staff", cs, S)):
    write(OUT, t, cols, R)
with io.open(os.path.join(V, "_scope_log.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["table", "key", "col", "old", "new", "why"])
    w.writeheader()
    w.writerows(log)
if not os.listdir(OUTU):
    os.rmdir(OUTU)
    os.rmdir(VU)
print("뺀 행", dict(removed))
print("시설", len(A), C.Counter((a.get("mgmt_class"), a["asset_gbn"]) for a in A).most_common(12))
print("TG04 배정 D23", len(moved_asg), "과제", len(mv_task), "· 바뀐 칸", len(log))
print("근거 법령 예", [(a["asset_name"], a["mgmt_laws"]) for a in A[:3]])
