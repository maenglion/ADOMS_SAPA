# -*- coding: utf-8 -*-
"""
예산 화면(/budget) · 교육 실시 점검 화면(/training)용 예시 자료 — ops_v0.6 (2026-09-21)

뼈대 (원문 대조: 법령DB unit_20260901_v2.1_before_20260920u.csv)
  · 중대재해처벌법 시행령 제4조제4호(DOC-000005 a4/n4) — 가·나·다목 사항을 이행하는 데 필요한
    예산을 편성하고 그 편성된 용도에 맞게 집행하도록 할 것
      가목(a4/n4/mga) 재해 예방을 위해 필요한 안전ㆍ보건에 관한 인력, 시설 및 장비의 구비
      나목(a4/n4/mna) 제3호에서 정한 유해ㆍ위험요인의 개선
      다목(a4/n4/mda) 그 밖에 … 고용노동부장관이 정하여 고시하는 사항
        ★ 다목 고시는 아직 없다(시행령 lsDelegated 0건 · 수집완결성 포크 작업기록 H).
          그래서 어떤 예산도 다목으로 분류하지 않는다. 교육·훈련비·운영비·기타는 「가·나목 밖」으로 둔다.
  · 시행령 제5조제2항제3호(a5/p2/n3) 유해ㆍ위험한 작업에 관한 안전ㆍ보건 교육 실시 여부 반기 1회 이상 점검
  · 시행령 제5조제2항제4호(a5/p2/n4) 실시되지 않은 교육 — 지체 없이 이행 지시·예산 확보 등

교육 과정의 법정 이름·주기·시간은 법령DB 원문에서 확인한 것만 쓴다.
  산업안전보건법 제29조①②③(DOC-000057) · 제32조①(1~2호) · 시행규칙 제26조·제29조(DOC-000059) ·
  시행규칙 별표 4(SCH-0001600: 제1호가·나·라목 · 제1호의2 가목 · 제2호) ·
  시행규칙 별표 5 제1호라목 17(법령DB) · 34(법령DB 별표 본문이 잘려 있어 lawxml\263749.xml 로 확인) ·
  승강기 안전관리법 제29조⑤(DOC-000018) · 시행규칙 제52조(DOC-000020) ·
  어린이놀이시설 안전관리법 제20조(DOC-000469) · 시행규칙 제20조④(DOC-000471) ·
  시설물안전법 시행규칙 제10조(DOC-000032) · 중대재해처벌법 제8조①(DOC-000004) · 시행령 제6조①

만드는 표 (ops_v0.6 폴더에 이 세 개만 — 같은 폴더에 다른 생성기가 다른 표를 둔다)
  · safety_budget.csv    — v0.2 70행 보존 + 칸 추가(budget_item 고정 6행 이름 · budget_use 가/나/밖 ·
                           use_basis · risk_item_id) + 나목 예시 행
  · training_course.csv  — 법정 교육 과정(이름·근거·대상·주기·시간·적용 부서·유해위험 작업 여부)
  · training_record.csv  — v0.2 28행 보존 + 칸 추가(course_id · period · due_date · status · note) + 예시 행
                           (status: 이수 / 미실시. 미실시이고 기한이 지난 것은 화면이 「기한 초과」로 본다)

일부러 비워 둔 곳 (화면에서 짚을 자리)
  · 나목(유해·위험요인 개선) 예산이 없는 부서 — 공원녹지과(D06)는 위험성평가 「높음」(RSK-007-1 추락) 조치가
    끝나지 않았는데 나목 예산이 없다
  · 하수도과(D05) 밀폐공간 특별교육 미실시(기한 초과) — 하수관로 준설(RSK-009) 부서
  · 근로자 정기교육 상반기 미실시 2개 부서(D12 · D14)
  · 어린이놀이시설 안전교육 기한 초과(D06)

사용: python _build/build_budget_training_v06.py [--force]
  판 폴더에 같은 이름의 CSV 가 하나라도 있으면 아무것도 쓰지 않고 멈춘다(판 덮어쓰기 금지).
"""
import csv, io, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC2 = os.path.join(BASE, "ops_v0.2_20260920", "seed")
SRC3 = os.path.join(BASE, "ops_v0.3_20260921", "seed")
OUT = os.path.join(BASE, "ops_v0.6_20260921", "seed")
EX = "예시 자료(시연용)"
FORCE = "--force" in sys.argv
NAMES = ["safety_budget", "training_course", "training_record"]
DEPTS = ["D%02d" % i for i in range(1, 15)]


def rd(folder, name):
    with io.open(os.path.join(folder, name + ".csv"), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def wr(name, rows, cols):
    p = os.path.join(OUT, name + ".csv")
    with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            assert set(r) <= set(cols), (name, set(r) - set(cols))
            w.writerow({c: r.get(c, "") for c in cols})
    print("  %-22s %4d행" % (name + ".csv", len(rows)))


os.makedirs(OUT, exist_ok=True)
hit = [n for n in NAMES if os.path.exists(os.path.join(OUT, n + ".csv"))]
if hit and not FORCE:
    sys.exit("멈춤: %s 가 이미 있다(판 덮어쓰기 금지). 발행 전 판이면 --force" % ", ".join(hit))

staff_ids = {r["staff_id"] for r in rd(SRC3, "staff")}
risk_items = {r["risk_item_id"]: r for r in rd(SRC3, "risk_assessment_item")}

# ── safety_budget ────────────────────────────────────────────────
USE_BASIS = {"가": "시행령 제4조제4호가목", "나": "시행령 제4조제4호나목", "밖": ""}
# 기존 5종 → 고정 6행 이름 · 용도
KIND_MAP = {
    "인력": ("안전·보건 인력비", "가"),
    "시설": ("시설·장비 구입비", "가"),
    "장비": ("시설·장비 구입비", "가"),
    "교육": ("교육·훈련비", "밖"),
    "점검": ("운영비", "밖"),
}
B_COLS = ["budget_id", "fiscal_year", "dept_id", "target_code", "budget_kind", "budget_item",
          "budget_use", "use_basis", "planned_amount", "executed_amount", "risk_item_id",
          "duty_key", "updated_at", "note"]
budget = []
for r in rd(SRC2, "safety_budget"):
    item, use = KIND_MAP[r["budget_kind"]]
    row = dict(r)
    row.update(budget_item=item, budget_use=use, use_basis=USE_BASIS[use],
               note=EX if r["note"].startswith("예시") else r["note"])
    if use == "밖":
        row["note"] = EX + " · 가·나목 밖(다목 고시 없음) — 용도 확인 필요"
    budget.append(row)

# 나목 — 위험성평가 「높음」 개선 과제에 붙인 예시 행. 공원녹지과(D06)는 일부러 없다.
NA = [
    ("D03", "RSK-004-1", "도로 보수 현장 신호수·차선 통제 장비", 48000000, 41000000),
    ("D04", "RSK-001-1", "정수장 염소 누출 감지기 교체", 62000000, 58500000),
    ("D04", "RSK-002-1", "배수지 밀폐공간 산소농도 측정기·환기설비", 35000000, 12000000),
    ("D05", "RSK-003-1", "침전지 안전난간·개구부 덮개 설치", 54000000, 9800000),
    ("D05", "RSK-009-1", "하수관로 준설 가스 측정기·송기마스크", 27000000, 26100000),
    ("D13", "RSK-008-1", "재난 현장 통제선·구조물 안전 확인 장비", 18000000, 7200000),
]
for i, (d, rk, what, p, e) in enumerate(NA, start=71):
    assert rk in risk_items and risk_items[rk]["risk_level"] == "높음", rk
    budget.append(dict(budget_id="BUD-%04d" % i, fiscal_year="2026", dept_id=d, target_code="",
                       budget_kind="개선", budget_item="유해·위험요인 개선비", budget_use="나",
                       use_basis=USE_BASIS["나"], planned_amount=str(p), executed_amount=str(e),
                       risk_item_id=rk, duty_key="", updated_at="2026-09-01",
                       note="%s · %s" % (EX, what)))
# 기타 — 고정 6행의 마지막 칸이 비어 보이지 않게 한 줄
budget.append(dict(budget_id="BUD-0077", fiscal_year="2026", dept_id="D01", target_code="",
                   budget_kind="기타", budget_item="기타", budget_use="밖", use_basis="",
                   planned_amount="15000000", executed_amount="4200000", risk_item_id="",
                   duty_key="", updated_at="2026-09-01",
                   note=EX + " · 안전보건 홍보물 · 가·나목 밖 — 용도 확인 필요"))

# ── training_course ──────────────────────────────────────────────
C_COLS = ["course_id", "course_name", "law", "basis", "target", "cycle", "cycle_months",
          "required_hours", "applies_depts", "hazardous_work", "note"]
ALL = " ".join(DEPTS)
course = [
    dict(course_id="TC01", course_name="근로자 정기교육", law="산업안전보건법",
         basis="산업안전보건법 제29조제1항 · 시행규칙 제26조제1항 · 별표 4 제1호가목",
         target="소속 근로자", cycle="반기", cycle_months="6",
         required_hours="사무직 매반기 6시간 이상 · 그 밖의 근로자(판매업무 외) 매반기 12시간 이상",
         applies_depts=ALL, hazardous_work="N", note=EX),
    dict(course_id="TC02", course_name="관리감독자 정기교육", law="산업안전보건법",
         basis="산업안전보건법 제29조제1항 · 시행규칙 제26조제1항 · 별표 4 제1호의2 가목",
         target="관리감독자", cycle="연", cycle_months="12", required_hours="연간 16시간 이상",
         applies_depts=ALL, hazardous_work="N", note=EX),
    dict(course_id="TC03", course_name="채용 시 교육", law="산업안전보건법",
         basis="산업안전보건법 제29조제2항 · 시행규칙 제26조제1항 · 별표 4 제1호나목",
         target="새로 채용한 근로자", cycle="채용 시", cycle_months="",
         required_hours="그 밖의 근로자 8시간 이상(일용·단기 기간제는 1~4시간 이상)",
         applies_depts=ALL, hazardous_work="N", note=EX + " · 채용이 있을 때만 생긴다"),
    dict(course_id="TC04", course_name="특별교육 — 밀폐공간에서의 작업", law="산업안전보건법",
         basis="산업안전보건법 제29조제3항 · 시행규칙 제26조제1항 · 별표 4 제1호라목 · 별표 5 제1호라목 34",
         target="밀폐공간 작업에 배치하는 근로자", cycle="작업 배치 시", cycle_months="",
         required_hours="16시간 이상(최초 작업 전 4시간 이상, 12시간은 3개월 이내 분할 가능) · 단기간·간헐적 작업은 2시간 이상",
         applies_depts="D04 D05", hazardous_work="Y", note=EX),
    dict(course_id="TC05", course_name="특별교육 — 전압 75볼트 이상 정전 및 활선작업", law="산업안전보건법",
         basis="산업안전보건법 제29조제3항 · 시행규칙 제26조제1항 · 별표 4 제1호라목 · 별표 5 제1호라목 17",
         target="정전·활선 작업에 배치하는 근로자", cycle="작업 배치 시", cycle_months="",
         required_hours="16시간 이상(최초 작업 전 4시간 이상, 12시간은 3개월 이내 분할 가능) · 단기간·간헐적 작업은 2시간 이상",
         applies_depts="D04", hazardous_work="Y", note=EX),
    dict(course_id="TC06", course_name="안전보건관리책임자 직무교육", law="산업안전보건법",
         basis="산업안전보건법 제32조제1항제1호 · 시행규칙 제29조제1항 · 별표 4 제2호가목",
         target="안전보건관리책임자", cycle="2년(보수)", cycle_months="24",
         required_hours="신규 6시간 이상(선임 후 3개월 이내) · 보수 6시간 이상",
         applies_depts="D01", hazardous_work="N", note=EX + " · 기관 단위"),
    dict(course_id="TC07", course_name="안전관리자 직무교육", law="산업안전보건법",
         basis="산업안전보건법 제32조제1항제2호 · 시행규칙 제29조제1항 · 별표 4 제2호나목",
         target="안전관리자", cycle="2년(보수)", cycle_months="24",
         required_hours="신규 34시간 이상(선임 후 3개월 이내) · 보수 24시간 이상",
         applies_depts=ALL, hazardous_work="N", note=EX + " · 선임 현황은 체계 수립 화면과 같은 자료"),
    dict(course_id="TC08", course_name="승강기관리교육", law="승강기 안전관리법",
         basis="승강기 안전관리법 제29조제5항 · 시행규칙 제52조",
         target="승강기 안전관리자", cycle="3년(정기)", cycle_months="36",
         required_hours="시행규칙 별표 10에 따름",
         applies_depts="D08 D09 D10", hazardous_work="N", note=EX),
    dict(course_id="TC09", course_name="어린이놀이시설 안전교육", law="어린이놀이시설 안전관리법",
         basis="어린이놀이시설 안전관리법 제20조제1항 · 시행규칙 제20조",
         target="어린이놀이시설 안전관리자", cycle="2년", cycle_months="24",
         required_hours="1회 4시간 이상(2년에 1회 이상)",
         applies_depts="D06 D07", hazardous_work="N", note=EX),
    dict(course_id="TC10", course_name="정기안전점검 책임기술자 교육", law="시설물의 안전 및 유지관리에 관한 특별법",
         basis="시설물의 안전 및 유지관리에 관한 특별법 시행규칙 제10조제1항·제2항",
         target="책임기술자 및 그 감독하에 안전점검을 실시하는 사람", cycle="5년(보수)", cycle_months="60",
         required_hours="신규 35시간 이상 · 보수 7시간 이상",
         applies_depts="D03 D04 D05 D09", hazardous_work="N", note=EX),
    dict(course_id="TC11", course_name="경영책임자 안전보건교육", law="중대재해 처벌 등에 관한 법률",
         basis="중대재해 처벌 등에 관한 법률 제8조제1항 · 시행령 제6조제1항",
         target="중대산업재해가 발생한 기관의 경영책임자등", cycle="발생 시", cycle_months="",
         required_hours="총 20시간의 범위",
         applies_depts="", hazardous_work="N", note=EX + " · 중대산업재해가 발생한 경우에만 의무"),
]
course_ids = {c["course_id"] for c in course}

# ── training_record ──────────────────────────────────────────────
T_COLS = ["training_id", "staff_id", "dept_id", "course_id", "course_name", "law", "hours",
          "period", "due_date", "trained_at", "status", "certificate_file", "duty_key", "note"]
NAME_MAP = {
    "관리감독자 정기교육": "TC02",
    "시설물 안전점검 실무": "TC10",
    "어린이놀이시설 안전관리자 교육": "TC09",
    "승강기 안전관리자 교육": "TC08",
    "중대재해처벌법 경영책임자 교육": "TC11",
}
DUE = {"TC02": "2026-12-31", "TC10": "", "TC09": "", "TC08": "", "TC11": ""}
PERIOD = {"TC02": "2026년", "TC10": "보수", "TC09": "2년 주기", "TC08": "3년 주기", "TC11": "-"}
record = []
for r in rd(SRC2, "training_record"):
    cid = NAME_MAP[r["course_name"]]
    row = dict(r)
    note = EX
    if cid == "TC10":
        note += " · 과정 이름은 기관 자체 명칭 — 법정 보수교육(7시간 이상)으로 연결"
    if cid == "TC11":
        note += " · 법정 대상(중대산업재해 발생 기관 경영책임자등)이 아닌 자율 수강"
    row.update(course_id=cid, period=PERIOD[cid], due_date=DUE[cid], status="이수",
               certificate_file=r["certificate_file"] or "이수증_%s.pdf" % r["training_id"], note=note)
    record.append(row)

n = [28]


def add(staff, dept, cid, hours, period, due, at, status, note=""):
    assert staff in staff_ids, staff
    assert cid in course_ids, cid
    n[0] += 1
    tid = "TRN-%04d" % n[0]
    c = next(x for x in course if x["course_id"] == cid)
    record.append(dict(training_id=tid, staff_id=staff, dept_id=dept, course_id=cid,
                       course_name=c["course_name"], law=c["law"], hours=str(hours) if hours else "",
                       period=period, due_date=due, trained_at=at, status=status,
                       certificate_file=("이수증_%s.pdf" % tid) if status == "이수" else "",
                       duty_key="", note=EX + (" · " + note if note else "")))


# TC01 근로자 정기교육 — 상반기(기한 06-30) · 하반기(기한 12-31). 담당은 부서 정담당(교육 담당)
H1_MISS = {"D12", "D14"}
H2_DONE = {"D01", "D02", "D03", "D04", "D09", "D13"}
for i, d in enumerate(DEPTS):
    s = "S%s-1" % d
    if d in H1_MISS:
        add(s, d, "TC01", "", "2026 상반기", "2026-06-30", "", "미실시", "부서 근로자 정기교육 미실시")
    else:
        add(s, d, "TC01", 12 if d not in ("D01", "D02") else 6, "2026 상반기", "2026-06-30",
            "2026-06-%02d" % (5 + i), "이수", "부서 근로자 대상 실시 기록")
    if d in H2_DONE:
        add(s, d, "TC01", 12 if d not in ("D01", "D02") else 6, "2026 하반기", "2026-12-31",
            "2026-09-%02d" % (2 + i), "이수", "부서 근로자 대상 실시 기록")
    else:
        add(s, d, "TC01", "", "2026 하반기", "2026-12-31", "", "미실시")

# TC02 관리감독자 정기교육 — 기존 기록이 없는 부서
for d, st, at in [("D02", "이수", "2026-04-17"), ("D04", "이수", "2026-05-12"), ("D05", "이수", "2026-05-20"),
                  ("D09", "이수", "2026-06-11"), ("D10", "이수", "2026-06-25"),
                  ("D07", "미실시", ""), ("D12", "미실시", ""), ("D14", "미실시", "")]:
    add("S%s-1" % d, d, "TC02", 16 if st == "이수" else "", "2026년", "2026-12-31", at, st)

# TC04·TC05 유해·위험 작업 특별교육 (시행령 제5조제2항제3호의 중심)
add("SD04-2", "D04", "TC04", 16, "배수지 유지보수 배치", "2026-03-20", "2026-03-10", "이수", "배수지 유지보수 위험성평가 부서")
add("SD05-2", "D05", "TC04", "", "하수관로 준설 배치", "2026-06-08", "", "미실시", "하수관로 준설 작업 — 작업 전 실시해야 했음")
add("SD04-1", "D04", "TC05", 16, "정수장 전기실 배치", "2026-06-30", "2026-06-15", "이수", "정수장 전기실 위험성평가 부서")

# TC06 안전보건관리책임자 — 기관 단위
add("SM01-1", "D01", "TC06", 6, "보수", "2026-11-30", "2026-02-24", "이수", "보수교육")

# TC07 안전관리자(부서 부담당이 겸직 선임 — 체계 수립 화면의 선임 현황과 같은 사람)
for d in DEPTS:
    s = "S%s-2" % d
    if d in ("D10", "D12"):
        add(s, d, "TC07", "", "보수", "2026-08-31", "", "미실시", "보수교육 기한 경과")
    elif d in ("D08",):
        add(s, d, "TC07", "", "보수", "2026-11-30", "", "미실시")
    else:
        add(s, d, "TC07", 24, "보수", "2027-02-28", "2025-%02d-15" % (3 + DEPTS.index(d) % 9), "이수", "보수교육")

# TC08 승강기관리교육 — 기존 기록: D10(2026-08-07)
add("SD08-2", "D08", "TC08", "", "3년 주기", "", "2025-10-21", "이수")
add("SD09-2", "D09", "TC08", "", "3년 주기", "2026-10-31", "", "미실시", "직전 교육 후 3년 도래")

# TC09 어린이놀이시설 — 기존 기록: D07(2026-07-14)
add("SD06-2", "D06", "TC09", "", "2년 주기", "2026-09-15", "", "미실시", "유효기간 만료 전 3개월 안에 받아야 함")

# TC10 정기안전점검 책임기술자 — 기존 기록: D04 · D09
add("SD03-2", "D03", "TC10", 7, "보수", "", "2026-03-27", "이수", "보수교육")
add("SD05-1", "D05", "TC10", "", "보수", "2026-11-30", "", "미실시")

# 검사
for r in record:
    assert r["staff_id"] in staff_ids, r
    assert r["status"] in ("이수", "미실시"), r
assert len({r["training_id"] for r in record}) == len(record)
assert len({r["budget_id"] for r in budget}) == len(budget)

print("쓰는 곳:", OUT)
wr("safety_budget", budget, B_COLS)
wr("training_course", course, C_COLS)
wr("training_record", record, T_COLS)
