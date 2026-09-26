# -*- coding: utf-8 -*-
"""
결재선(실무자 → 부서장 → 총괄 → 경영책임자) — 과제 결재 기록에 「부서장 확인」 칸을 더한다(2026-09-24).
→ ops_v1.5_20260924/seed/task_approval_patch.csv (앞 판 ops_v0.3 은 그대로)

  · 칸 추가: head_ok_at · head_ok_by(부서장 확인) — 총괄 승인 전에 부서장이 확인한다.
  · 예시 자료: 이미 「승인」된 과제는 부서장 확인을 거친 것으로(제출 다음 날, 그 과제 부서의 부서장),
    「제출」 상태 과제는 과제 번호 짝·홀로 반씩 — 반은 부서장 확인을 마치고 총괄 승인을 기다리고, 반은 부서장 확인을 기다린다
    (두 결재 대기열이 모두 보이게). 가상 자료이며 규칙이 정해져 있어 다시 돌려도 같다.
  · 과제의 부서 = 배정의 부서(ops_v1.5 duty_assignment), 부서장 = 그 부서의 approval_level 2 직원.
"""
import csv, glob, io, os, sys, datetime as dt
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
OUT = os.path.join(DEMO, "ops_v1.5_20260924", "seed", "task_approval_patch.csv")

def latest(t):
    return sorted(glob.glob(os.path.join(DEMO, "ops_*", "seed", f"{t}.csv")))[-1]
def read(p):
    with io.open(p, encoding="utf-8-sig") as f:
        r = csv.DictReader(f); return list(r.fieldnames), list(r)

def main():
    if os.path.exists(OUT): sys.exit("이미 있다 — 판을 덮어쓰지 않는다: " + OUT)
    cols, rows = read(latest("task_approval_patch"))
    _, tasks = read(latest("compliance_task"))
    _, asg = read(latest("duty_assignment"))
    _, staff = read(latest("staff"))
    dept_of_asg = {a["assign_id"]: a["dept_id"] for a in asg}
    dept_of_task = {t["task_id"]: dept_of_asg.get(t["assign_id"], "") for t in tasks}
    head = {s["dept_id"]: s["staff_id"] for s in staff if s.get("approval_level") == "2"}
    cols = cols + [c for c in ("head_ok_at", "head_ok_by") if c not in cols]
    n_ok = n_wait = n_appr = 0
    for r in rows:
        r.setdefault("head_ok_at", ""); r.setdefault("head_ok_by", "")
        st = r.get("approval_status", "")
        d = dept_of_task.get(r["task_id"], "")
        h = head.get(d, "")
        sub = (r.get("submitted_at") or "")[:10]
        nxt = ""
        if sub:
            try: nxt = (dt.date.fromisoformat(sub) + dt.timedelta(days=1)).isoformat()
            except ValueError: nxt = sub
        if st == "승인" and h:
            r["head_ok_at"], r["head_ok_by"] = nxt or (r.get("approved_at") or "")[:10], h; n_appr += 1
        elif st == "제출" and h:
            num = int("".join(ch for ch in r["task_id"] if ch.isdigit()) or 0)
            if num % 2 == 0:
                r["head_ok_at"], r["head_ok_by"] = nxt, h; n_ok += 1
            else:
                n_wait += 1
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with io.open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
    print(f"결재 기록 {len(rows)}줄 · 승인(부서장 확인 거침) {n_appr} · 제출 중 부서장 확인 끝 {n_ok} · 부서장 확인 대기 {n_wait}")

if __name__ == "__main__":
    main()
