# -*- coding: utf-8 -*-
"""
[400 · 교육자료 버전] 묶음 C — 의무이행(실적증빙) 사업장 트랙 예시 행 만들기 (2026-09-24)

출력: ../seed/usc_record.csv  (앱이 readTable("usc_record","rec_id") 로 읽는다)
원천: 공통 판 ops_* 의 최신 CSV (safety_budget · order_received · incident · incident_nil_check
      · training_record · worker_voice · drill_plan · duty_class · staff · org_dept) — 읽기만 한다.

표 한 줄 = 화면 표의 한 행.
  rec_id · dept_id · year · step(단계 key) · section(표 구분) · parent_id · ord · locked · deleted
  · status(이행완료/보완필요/미이행 — 행 값에서 계산) · data(행 값 JSON) · files(첨부 JSON) · updated_at · updated_by
고정 행(예산 6항목·재해 카드 3행·표 밖 입력·해당없음 체크)은 앱과 같은 규칙의 결정적 번호를 쓴다.
사람 이름은 직원 명부(staff)의 가상 인물, 부서는 용인시 실제 부서명.
"""
import csv, glob, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(HERE, "..", "seed", "usc_record.csv")
YEAR = "2026"


def table(name):
    fs = sorted(glob.glob(os.path.join(ROOT, "ops_*", "seed", f"{name}.csv")))
    if not fs:
        return []
    with open(fs[-1], encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


staff = {s["staff_id"]: s for s in table("staff")}
dept = {d["dept_id"]: d["dept_name"] for d in table("org_dept")}
nm = lambda sid: staff[sid]["display_name"]
dn = lambda sid: dept.get(staff[sid]["dept_id"], "")

rows = []
seq = [0]


def fid(name, url=""):
    return {"name": name, "url": url, "at": "2026-01-01T00:00:00"}


def status_of(d, files, date_keys):
    has_date = any(str(d.get(k, "")).strip() for k in date_keys)
    if has_date and files:
        return "이행완료"
    if has_date or files or any(str(v).strip() for v in d.values()):
        return "보완필요"
    return "미이행"


def add(dept_id, step, section, data, files=(), rec_id=None, parent="", locked="", date_keys=("date",), status=None):
    seq[0] += 1
    files = [fid(x) if isinstance(x, str) else x for x in files if x]
    rows.append({
        "rec_id": rec_id or f"USC-S{seq[0]:04d}",
        "dept_id": dept_id, "year": YEAR, "step": step, "section": section,
        "parent_id": parent, "ord": str(seq[0]), "locked": locked, "deleted": "",
        "status": status or status_of(data, files, date_keys),
        "data": json.dumps(data, ensure_ascii=False), "files": json.dumps(files, ensure_ascii=False),
        "updated_at": "2026-09-24", "updated_by": "",
    })


def fixed(dept_id, step, tail):
    return f"USC-{dept_id}-{YEAR}-{step}-{tail}"


BUDGET_ITEMS = ["안전·보건 인력비", "시설·장비 구입비", "유해·위험요인 개선비", "교육·훈련비", "운영비", "기타"]

for D, P in (("D03", "SD03"), ("D04", "SD04")):
    main, sub = f"{P}-1", f"{P}-2"
    # ① 1) 안전·보건 목표 및 경영방침 설정
    add(D, "goal", "main", {"date": "2026-01-15", "note": ""}, ["용인특례시 안전보건 경영방침.pdf"])
    # ① 2) 전담 조직
    add(D, "org", "main", {"date": "2026-01-02", "content": "중대재해예방과 안전·보건 전담조직 지정(조직도·인력현황)", "note": ""},
        ["용인특례시 안전보건 전담조직도.pdf", "안전보건 전담조직 인력현황표.xlsx"])
    # ① 3) 안전보건관계자 배치 — 관리감독자 행은 관리대상 현황에서 넘어온 것(편집 잠금)
    add(D, "staff", "main", {"rank": "안전보건관리책임자", "trust": "", "date": "2026-01-02", "name": nm("SM01-1"), "org": dn("SM01-1"), "note": ""},
        ["안전보건관리책임자 지정 공문.pdf"])
    add(D, "staff", "main", {"rank": "안전보건총괄책임자", "trust": "", "date": "2026-01-02", "name": nm("SM02-1"), "org": dn("SM02-1"), "note": ""},
        ["안전보건총괄책임자 지정 공문.pdf"])
    add(D, "staff", "main", {"rank": "안전관리자", "trust": "Y", "date": "2026-02-01", "name": nm("SD02-2"), "org": dn("SD02-2"), "note": "안전관리전문기관 위탁"},
        ["안전관리 위탁계약서.pdf"])
    add(D, "staff", "main", {"rank": "보건관리자", "trust": "Y", "date": "2026-02-01", "name": nm("SD11-1"), "org": dn("SD11-1"), "note": "보건관리전문기관 위탁"}, [])
    add(D, "staff", "main", {"rank": "관리감독자", "trust": "", "date": "2026-01-02", "name": nm(main), "org": dept[D], "note": ""}, [], locked="Y")
    # ① 4) 위험성평가 — 표 밖 입력(위험성평가 일자)
    add(D, "risk", "hdr", {"date": "2026-03-10", "kind": "정기평가"}, rec_id=fixed(D, "risk", "hdr"), status="-")
    add(D, "risk", "main", {"gbn": "위험성평가 교육", "fixed": "Y", "date": "2026-03-03", "content": "관리감독자·근로자 위험성평가 사전교육", "note": ""},
        ["위험성평가 교육 결과서.pdf"])
    add(D, "risk", "main", {"gbn": "위험성평가 이행결과", "fixed": "Y", "date": "2026-03-10",
                            "content": "도로·교량 유지보수 작업 정기 위험성평가" if D == "D03" else "정수장·배수지 작업 정기 위험성평가", "note": ""},
        ["정기 위험성평가 결과보고서.pdf"])
    # ① 5) 안전예산 — 고정 6항목, 우리 예산 자료(safety_budget, 중대산업재해 I)에서 천원 단위로
    bud = {}
    for b in table("safety_budget"):
        if b["dept_id"] != D or b.get("area") != "I":
            continue
        item = b["budget_item"] if b["budget_item"] in BUDGET_ITEMS else "기타"
        x = bud.setdefault(item, {"plan": 0, "exec": 0, "memo": []})
        x["plan"] += int(b["planned_amount"] or 0) // 1000
        x["exec"] += int(b["executed_amount"] or 0) // 1000
        memo = b["note"].split("·", 1)[-1].strip() if "·" in b["note"] else ""
        if memo:
            x["memo"].append(memo)
    for i, item in enumerate(BUDGET_ITEMS, 1):
        x = bud.get(item)
        if not x:
            continue
        add(D, "budget", "main", {"item": item, "plan": str(x["plan"]), "date": "2026-08-31", "content": " · ".join(x["memo"]),
                                  "exec": str(x["exec"]), "note": ""},
            [f"{item} 집행 내역.pdf"], rec_id=fixed(D, "budget", str(i)))
    # ① 6) 안전보건관계자 업무수행 — 반기 평가
    add(D, "work", "main", {"rel": "안전보건관리책임자", "trust": "", "date": "2026-06-30", "name": nm("SM01-1"), "org": dn("SM01-1"), "note": ""},
        ["상반기 업무수행 평가표(안전보건관리책임자).pdf"])
    add(D, "work", "main", {"rel": "안전관리자", "trust": "Y", "date": "2026-06-30", "name": nm("SD02-2"), "org": dn("SD02-2"), "note": ""},
        ["상반기 업무수행 평가표(안전관리자).pdf"])
    add(D, "work", "main", {"rel": "관리감독자", "trust": "", "date": "2026-06-30", "name": nm(main), "org": dept[D], "note": ""},
        ["상반기 업무수행 평가표(관리감독자).pdf"], locked="Y")
    add(D, "work", "main", {"rel": "관리감독자", "trust": "", "date": "2026-06-30", "name": nm(sub), "org": dept[D], "note": ""},
        [], locked="Y")
    # ① 7) 종사자 의견 청취 — 표A 산업안전보건위원회, 표B 필요 개선조치(우리 의견 청취 기록 worker_voice)
    add(D, "opinion", "hdr", {"date": "2026-03-25"}, rec_id=fixed(D, "opinion", "hdr"), status="-")
    add(D, "opinion", "a", {"gbn": "산업안전보건위원회 운영", "date": "2026-03-25", "content": "1분기 산업안전보건위원회 정기회의", "note": ""},
        ["1분기 산업안전보건위원회 회의록.pdf"])
    add(D, "opinion", "a", {"gbn": "산업안전보건위원회 운영", "date": "2026-06-24", "content": "2분기 산업안전보건위원회 정기회의", "note": ""},
        ["2분기 산업안전보건위원회 회의록.pdf"])
    for v in table("worker_voice"):
        if v["dept_id"] != D:
            continue
        add(D, "opinion", "b", {"gbn": f"기타 종사자 의견 청취({v['channel']})", "date": v["done_at"] or v["reviewed_at"],
                                "content": v['content'] + (f" → {v['action_taken'] or v['plan']}" if (v['action_taken'] or v['plan']) else ""), "note": ""},
            ["개선조치 결과서.pdf"] if v["done_at"] else [])
    # ① 8) 비상조치계획 — 우리 비상대응훈련 계획(drill_plan)에서 해당 부서 것
    add(D, "emergency", "main", {"rank": "안전보건관리책임자", "date": "2026-02-20", "content": "비상조치계획 수립(재해발생 시나리오·구성원별 역할·비상연락망)", "note": ""},
        ["비상조치계획서.pdf"])
    drills = [x for x in table("drill_plan") if x["dept_id"] == D and x["year"] == YEAR]
    for x in drills:
        add(D, "emergency", "main", {"rank": "비상조치훈련 실시", "date": (x["done_at"] or x["planned_at"])[:10],
                                     "content": f"{x['drill_type']} 대응 훈련 — {x['scenario']}", "note": x["status"]},
            ["비상조치훈련 결과서.pdf"] if x["done_at"] else [])
    if not drills:
        add(D, "emergency", "main", {"rank": "비상조치훈련 실시", "date": "2026-05-20",
                                     "content": "상반기 비상조치훈련(화재 대피)", "note": ""}, ["비상조치훈련 결과서.pdf"])

# ② 재해 발생시 재발방지대책 — 우리 사고 기록(incident)의 산업재해를 카드로, 없으면 「발생 이력 없음」 확인(incident_nil_check)
ITEMS = ["1. 재해발생 상황보고서", "2. 산업재해조사표", "3. 재발방지계획서"]
for inc in table("incident"):
    if inc["disaster_type"] not in ("산업재해", "중대산업재해") or not inc["occurred_at"].startswith(YEAR):
        continue
    D = inc["dept_id"]
    cid = f"USC-INC-{inc['incident_id']}"
    add(D, "recur", "inc", {"name": inc["summary"].replace("(가상)", "").strip(), "date": inc["occurred_at"], "src": inc["incident_id"]}, rec_id=cid)
    vals = [
        (inc["occurred_at"], f"발생 보고 — {inc['accident_type'] or ''} {inc['casualties']}".strip(), ""),
        (inc["investigated_at"], f"원인 조사 — {inc['cause']}", inc["cause_evidence"]),
        (inc["plan_set_at"], inc["recurrence_plan"], inc["plan_evidence"]),
    ]
    for i, (d, c, f) in enumerate(vals, 1):
        add(D, "recur", "incrow", {"item": str(i), "date": d, "content": c, "note": ""}, [f] if f else [],
            rec_id=f"{cid}-r{i}", parent=cid)
for n in table("incident_nil_check"):
    if n["period"].startswith(YEAR) and n["dept_id"] not in {r["dept_id"] for r in rows if r["step"] == "recur" and r["section"] == "inc"}:
        rid = fixed(n["dept_id"], "recur", "nil")
        if any(r["rec_id"] == rid for r in rows):
            continue
        add(n["dept_id"], "recur", "nil", {"nil": "Y", "memo": n["memo"], "date": n["confirmed_at"]}, rec_id=rid, status="해당없음")

# ③ 개선·시정 — 우리 개선·시정 명령 접수 기록(order_received)
for o in table("order_received"):
    if not o["received_at"].startswith(YEAR):
        continue
    ev = o["report_evidence"] or o["evidence_file"]
    add(o["dept_id"], "order", "main", {
        "item": o["content"], "agency": o["issuer"], "date": o["received_at"],
        "content": o["done_note"] or o["action_plan"] or "", "from": o["started_at"] or o["assigned_at"],
        "to": o["done_at"] or o["extended_due"] or o["due_date"], "note": o["result"], "src": o["order_id"]},
        [ev] if ev else [], date_keys=("to",) if o["done_at"] else ("__",))

# ④ 관계 법령 의무이행 — 우리 의무 목록(duty_class, 중대산업재해 I)에서 산업안전보건법 핵심 조문
duty = {d["duty_key"]: d for d in table("duty_class") if d["area"] == "I"}
PICK = ["DTY-02937", "DTY-02931", "DTY-02935", "DTY-02909"]
for D in ("D03", "D04"):
    for k in PICK:
        d = duty.get(k)
        if not d:
            continue
        done = k in ("DTY-02937", "DTY-02931")
        add(D, "law", "law", {"duty_key": k, "date": "2026-03-10" if done else "", "st": "이행완료" if done else "미이행", "note": ""},
            ["관계 법령 의무이행 결과서.pdf"] if done else [], status="이행완료" if done else "미이행")
    # 법정교육 이수 — 우리 교육 이수 기록(training_record)
    for t in table("training_record"):
        if t["dept_id"] != D or t["status"] != "이수" or t["law"] != "산업안전보건법":
            continue
        add(D, "law", "edu", {"name": t["course_name"], "law": t["law"], "article": "제29조" if "정기" in t["course_name"] or "특별" in t["course_name"] else "제32조",
                              "target": nm(t["staff_id"]), "agency": "안전보건공단", "date": t["trained_at"], "note": "", "src": t["training_id"]},
            [t["certificate_file"]] if t["certificate_file"] else [])

cols = ["rec_id", "dept_id", "year", "step", "section", "parent_id", "ord", "locked", "deleted", "status", "data", "files", "updated_at", "updated_by"]
with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)
print(len(rows), "rows ->", OUT)
from collections import Counter
print(Counter((r["dept_id"], r["step"]) for r in rows))
