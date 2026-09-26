# -*- coding: utf-8 -*-
"""
정합성 검수 — 조직 재편(ops_v1.5 · us_v1.1) 전후를 같은 규칙으로 잰다(2026-09-24).
앱이 실제로 읽는 모양 그대로: 표마다 가장 새 판(us_* 먼저 · 400 기준) + 화면 입력 저장 파일(.data/overlay.json).
검사 목록(V1~V10)과 결과를 _integrity_report.json 과 표준 출력으로 낸다. 전(v1.4 까지) 결과와 나란히 비교한다.
"""
import csv, glob, io, json, os, re, sys, collections as C
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
APPS = os.path.normpath(os.path.join(DEMO, "..", "..", "..", "..", "20_개발", "_데모_용인시_20260920", "04_앱"))

def load(max_ops=None, us=True):
    L = {}
    dirs = sorted(d for d in os.listdir(DEMO) if d.startswith("ops_") and (not max_ops or d <= max_ops))
    for d in dirs:
        for f in glob.glob(os.path.join(DEMO, d, "seed", "*.csv")): L[os.path.basename(f)[:-4]] = f
    if us:
        for d in sorted(x for x in os.listdir(DEMO) if x.startswith("us_") and (not max_ops or x <= "us_v1.0_z")):
            for f in glob.glob(os.path.join(DEMO, d, "seed", "*.csv")): L[os.path.basename(f)[:-4]] = f
    T = {}
    for t, f in L.items():
        with io.open(f, encoding="utf-8-sig") as fh: T[t] = list(csv.DictReader(fh))
    return T

STAFF_COLS = ["owner_staff_id", "deputy_staff_id", "to_staff_id", "inspector_staff_id", "assessor_staff_id", "reviewer_staff_id",
              "checker_staff_id", "target_staff_id", "staff_id", "reporter_staff_id",
              "created_by", "submitted_by", "approved_by", "head_ok_by", "done_by", "uploaded_by", "decided_by", "judged_by", "started_by", "confirmed_by"]
def check(T, tag):
    R = {}
    depts = {r["dept_id"] for r in T["org_dept"]}
    staff = {r["staff_id"] for r in T["staff"]} | {"CEO-1"}
    # V1 부서 참조
    bad = C.Counter()
    for t, rows in T.items():
        if t == "org_dept": continue
        for r in rows:
            for col in ("dept_id", "scope_dept_id"):
                v = r.get(col, "")
                if v and v.startswith("D") and v not in depts: bad[f"{t}.{col}={v}"] += 1
            for col in ("target_dept_ids", "dept_ids", "applies_depts"):
                for v in re.split(r"[;,\s]+", r.get(col, "") or ""):
                    v = v.strip()
                    if v.startswith("D") and v not in depts: bad[f"{t}.{col}={v}"] += 1
    R["V1 없는 부서를 가리키는 행"] = dict(bad)
    # V2 직원 참조
    bad = C.Counter()
    for t, rows in T.items():
        if t == "staff": continue
        for r in rows:
            for col in STAFF_COLS:
                v = r.get(col, "")
                if v and re.match(r"^(SD|SM|S?D\d\d-|H\d\d$|G\d\d$|CEO)", v) and v not in staff: bad[f"{t}.{col}={v}"] += 1
    R["V2 없는 직원을 가리키는 행"] = dict(bad)
    # V3 직원의 부서
    R["V3 소속 부서가 없는 직원"] = [r["staff_id"] for r in T["staff"] if r.get("dept_id") and r["dept_id"] not in depts]
    # V4 시설에 걸린 배정의 부서 = 시설 부서
    am = {a["asset_id"]: a["dept_id"] for a in T["asset"]}
    mis = C.Counter((r["dept_id"], am[r["asset_id"]]) for r in T["duty_assignment"] if r["asset_id"] in am and r["dept_id"] != am[r["asset_id"]])
    R["V4 시설 배정 부서≠시설 부서"] = {f"{a}←시설{b}": n for (a, b), n in mis.items()}
    # V5 배정 담당자의 부서 = 배정 부서
    sd = {r["staff_id"]: r.get("dept_id", "") for r in T["staff"]}
    mis = C.Counter((r["dept_id"], sd.get(r["owner_staff_id"], "?")) for r in T["duty_assignment"] if r.get("owner_staff_id") and sd.get(r["owner_staff_id"]) != r["dept_id"])
    R["V5 정담당이 다른 부서 사람인 배정"] = {f"배정{a}·담당{b}": n for (a, b), n in mis.items()}
    # V6 과제 → 배정
    aids = {r["assign_id"] for r in T["duty_assignment"]}
    R["V6 배정이 없는 과제"] = sum(1 for r in T["compliance_task"] if r["assign_id"] not in aids)
    # V7 시설에 딸린 기록의 부서 = 시설 부서(시설 번호가 있는 행)
    out = C.Counter()
    for t in ("civil_safety_plan", "hazard_report", "contract", "incident", "order_received", "ceo_activity"):
        for r in T.get(t, []):
            a = r.get("asset_id", "")
            if a in am and r.get("dept_id") and r["dept_id"] != am[a]: out[t] += 1
    R["V7 시설 기록 부서≠시설 부서"] = dict(out)
    # V8 부서 계층
    R["V8 상위 부서가 없는 부서"] = [r["dept_id"] for r in T["org_dept"] if r.get("parent_dept_id") and r["parent_dept_id"] not in depts]
    # V9 결재선 — 부서마다 실무자·부서장
    if "approval_level" in (T["staff"][0] if T["staff"] else {}):
        need = [d for d in depts if d != "D99"]
        R["V9 부서장이 없는 부서"] = [d for d in need if not any(s["dept_id"] == d and s.get("approval_level") == "2" for s in T["staff"])]
        R["V9 실무자가 없는 부서"] = [d for d in need if not any(s["dept_id"] == d and s.get("approval_level") == "1" for s in T["staff"])]
    # V12 과제 결재 — 부서장 확인은 그 과제 부서의 부서장
    if T.get("task_approval_patch") and "head_ok_by" in T["task_approval_patch"][0]:
        dA = {a["assign_id"]: a["dept_id"] for a in T["duty_assignment"]}
        dT = {t["task_id"]: dA.get(t["assign_id"], "") for t in T["compliance_task"]}
        R["V12 다른 부서 부서장이 확인한 과제"] = sum(1 for r in T["task_approval_patch"] if r.get("head_ok_by") and sd.get(r["head_ok_by"]) != dT.get(r["task_id"]))
        R["V12 승인됐는데 부서장 확인 없는 과제"] = sum(1 for r in T["task_approval_patch"] if r.get("approval_status") == "승인" and not r.get("head_ok_by"))
    # V11 관리주체 아닌 시설(판정 제외)에 「해당」 배정
    ex = {a["asset_id"] for a in T["asset"] if a.get("sapa_l2_result") == "제외"}
    R["V11 판정 제외 시설에 「해당」 배정"] = sum(1 for r in T["duty_assignment"] if r["asset_id"] in ex and r["applicability"] == "해당")
    # V10 행 수
    R["행 수"] = {t: len(v) for t, v in sorted(T.items())}
    return R

def overlay_check(depts, staff):
    res = {}
    for app in ("adoms2_v2", "adoms2_v4"):
        p = os.path.join(APPS, app, ".data", "overlay.json")
        if not os.path.exists(p): continue
        o = json.load(io.open(p, encoding="utf-8")); bad = C.Counter()
        rows = []
        for t, v in (o.get("tables") or {}).items(): rows += [(t, r) for r in v]
        rows += [("evidence", r) for r in o.get("evidence", [])] + [("inspection", r) for r in o.get("inspection", [])]
        for t, r in rows:
            for col in ("dept_id",):
                v = r.get(col, "")
                if v and v.startswith("D") and v not in depts: bad[f"{t}.{col}={v}"] += 1
            for col in STAFF_COLS + ["by", "uploaded_by"]:
                v = str(r.get(col, "") or "")
                if re.match(r"^(SD|S D|H\d|G\d)", v) and v not in staff: bad[f"{t}.{col}={v}"] += 1
        res[app] = dict(bad)
    return res

def main():
    before = check(load("ops_v1.4_20260924", us=True), "전")
    T = load(None, us=True)
    after = check(T, "후")
    ov = overlay_check({r["dept_id"] for r in T["org_dept"]}, {r["staff_id"] for r in T["staff"]} | {"CEO-1"})
    rc = {t: (before["행 수"].get(t), after["행 수"].get(t)) for t in sorted(set(before["행 수"]) | set(after["행 수"])) if before["행 수"].get(t) != after["행 수"].get(t)}
    rep = {"전": {k: v for k, v in before.items() if k != "행 수"}, "후": {k: v for k, v in after.items() if k != "행 수"}, "행 수가 바뀐 표": rc, "화면 입력 저장 파일": ov}
    io.open(os.path.join(DEMO, "ops_v1.5_20260924", "_integrity_report.json"), "w", encoding="utf-8").write(json.dumps(rep, ensure_ascii=False, indent=1))
    for k in after:
        if k == "행 수": continue
        print(f"{k}\n   전: {before.get(k, '-')}\n   후: {after[k]}")
    print("행 수가 바뀐 표:", rc)
    print("화면 입력 저장 파일:", ov)

if __name__ == "__main__":
    main()
