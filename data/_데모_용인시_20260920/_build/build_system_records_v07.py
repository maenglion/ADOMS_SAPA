# -*- coding: utf-8 -*-
"""
① 체계 수립(/system) — 기록 입력용 예시 자료 · ops_v0.7 (2026-09-21)

뼈대: 중대재해처벌법 시행령 제4조 중 「기록할 입력이 없던 호」
  원문 대조: unit_20260901_v2.1_before_20260920u.csv DOC-000005 a4/n1·n3·n5·n7·n8 (추정 아님).
  · 제1호 목표·경영방침 설정
  · 제3호 유해·위험요인 확인·개선 절차 + 반기 1회 이상 점검
          단서: 산업안전보건법 제36조 위험성평가 절차를 마련하고, 실시(또는 실시하게) 하여
          **실시 결과를 보고받은 경우** 점검한 것으로 본다.
  · 제5호 가목 권한·예산 부여 / 나목 평가 기준 + 반기 1회 이상 평가·관리
          대상 = 산업안전보건법 제15조·제16조·제62조의 안전보건관리책임자·관리감독자·안전보건총괄책임자
  · 제7호 종사자 의견 청취 절차 + 개선방안 이행 반기 1회 이상 점검
          단서: 산업안전보건위원회(제24조)·협의체(제64조·제75조)에서 논의·심의·의결하면
          **의견을 들은 것으로 본다**(반기 점검까지 갈음되는 것은 아니다).
  · 제8호 가·나·다목 매뉴얼 + 매뉴얼에 따라 조치하는지 반기 1회 이상 점검

평가 기준표(eval_criteria) 항목은 법령 원문에서 읽었다.
  · 안전보건관리책임자 = 산업안전보건법 제15조제1항 제1호~제9호 (DOC-000057 a15/p1)
  · 관리감독자         = 같은 법 시행령 제15조제1항 제1호~제7호 (DOC-000058 a15/p1)
  · 안전보건총괄책임자 = 같은 법 시행령 제53조제1항 제1호~제5호 (DOC-000058 a53/p1)
  배점은 기관이 정하는 값이다(여기 값은 예시). 서울시 교육자료 p58 의 「법정 업무 = 평가항목」 방식을 따랐다.

만드는 표 (행 note 에 「예시 자료」)
  · system_record.csv — 호별 점검·평가·보고 기록(경영책임자 보고받음 칸 포함)
  · eval_criteria.csv — 제5호 나목 평가 기준표
  · worker_voice.csv  — ops_v0.2 의 5행을 값 그대로 두고 칸을 더함 + 예시 4행

일부러 남긴 빈 곳(화면에서 「할 일」로 보이게)
  · 제3호 — 하반기 점검(또는 위험성평가 결과 보고) 없음 · 상반기 점검의 필요 조치 미완료
  · 제5호 — 안전보건총괄책임자 권한·예산(해당 여부 확인) · 하반기 평가 없음 · 상반기 관리감독자 평가 7/13명
  · 제7호 — 하반기 반기 점검 없음 · 위원회 논의 보고 안 됨 · 기한 넘긴 개선방안 1건
  · 제8호 — 다목 매뉴얼 없음 · MAN-003 하반기 점검 없음 · MAN-004 점검 보고 안 됨

사용: python _build/build_system_records_v07.py
  판 폴더에 같은 이름의 CSV 가 있으면 멈춘다(판 덮어쓰기 금지).
"""
import csv, io, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "ops_v0.7_20260921", "seed")
SRC_VOICE = os.path.join(BASE, "ops_v0.2_20260920", "seed", "worker_voice.csv")
EX = "예시 자료(시연용)"

TABLES = ["system_record", "eval_criteria", "worker_voice"]
for t in TABLES:
    p = os.path.join(OUT, t + ".csv")
    if os.path.exists(p):
        sys.exit("멈춤: %s 가 이미 있다(판 덮어쓰기 금지)" % p)
os.makedirs(OUT, exist_ok=True)


def wr(name, rows, cols):
    p = os.path.join(OUT, name + ".csv")
    with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            assert set(r) <= set(cols), (name, set(r) - set(cols))
            w.writerow({c: r.get(c, "") for c in cols})
    print("  %-20s %4d행" % (name + ".csv", len(rows)))


# ── system_record ────────────────────────────────────────────────
REC_COLS = ["record_id", "clause_no", "mok", "record_kind", "title", "target_role", "target_ref",
            "target_staff_id", "dept_id", "done_at", "half", "checker_staff_id", "content",
            "action_needed", "action_done_at", "covers", "score", "item_scores", "substitute",
            "budget_amount", "doc_name", "ceo_reported", "reported_at", "report_method",
            "created_by", "note"]


def half(d):
    return "%s %s" % (d[:4], "상반기" if int(d[5:7]) <= 6 else "하반기")


rec = []


def R(**k):
    k.setdefault("note", EX)
    k["half"] = half(k["done_at"])
    k["record_id"] = "SYR-%03d" % (len(rec) + 1)
    rec.append(k)


# 제1호
R(clause_no="1", record_kind="문서 개정", title="용인시 안전보건 경영방침 개정", target_ref="POL-001",
  done_at="2026-01-05", checker_staff_id="SM01-1", content="경영방침 3개 문장 중 「종사자 의견을 듣는다」를 더함 · 청사 게시판과 내부 누리집 게시",
  ceo_reported="Y", reported_at="2026-01-05", report_method="전자 결재", created_by="SM01-1")
R(clause_no="1", record_kind="문서 등록", title="2026년 안전보건 목표 설정", target_ref="POL-002",
  done_at="2026-01-12", checker_staff_id="SM01-1", content="중대재해 0건 · 위험성평가 전 현장 · 고위험 요인 개선 100% · 관리감독자 교육 이수 100%",
  ceo_reported="Y", reported_at="2026-01-12", report_method="대면 보고", created_by="SM01-1")

# 제3호 — 상반기: 위험성평가 결과 보고(단서 갈음). 하반기는 비워 둔다.
R(clause_no="3", record_kind="위험성평가 결과 보고", title="2026 상반기 위험성평가 결과 보고", target_ref="MAN-001",
  done_at="2026-06-30", checker_staff_id="SM02-1", substitute="위험성평가",
  content="위험성평가 12개 현장 중 완료 10곳 결과와 「높음」 위험요인 개선 이행을 보고",
  action_needed="진행 중인 2곳(터널 점검 통로·옥상 방수 보수) 평가를 마치고 결과를 올릴 것", action_done_at="",
  ceo_reported="Y", reported_at="2026-07-03", report_method="전자 결재", created_by="SM02-1")

# 제5호 가목 — 권한·예산 부여 (안전보건총괄책임자는 해당 여부 확인 전이라 비워 둔다)
R(clause_no="5", mok="가", record_kind="권한·예산 부여", title="안전보건관리책임자 권한·예산 부여",
  target_role="안전보건관리책임자", target_ref="SOR-002", done_at="2026-02-10", checker_staff_id="SM01-1",
  content="안전관리자·보건관리자 지휘·감독(산업안전보건법 제15조제2항) · 기관 안전보건 예산 집행 결재 · 위험 작업 중지 지시",
  budget_amount="", doc_name="안전보건관리규정 제9조 · 2026년 안전보건 예산 배정표",
  ceo_reported="Y", reported_at="2026-02-10", report_method="전자 결재", created_by="SM01-1")
R(clause_no="5", mok="가", record_kind="권한·예산 부여", title="관리감독자 권한·예산 부여(부서별)",
  target_role="관리감독자", target_ref="", done_at="2026-02-10", checker_staff_id="SM01-1",
  content="소속 작업 중지 요청 · 보호구·안전물품 구입 요청 · 위험성평가 참여", budget_amount="1000000",
  doc_name="안전보건관리규정 제11조 · 부서별 안전물품 구입 예산(부서당)",
  ceo_reported="Y", reported_at="2026-02-10", report_method="전자 결재", created_by="SM01-1")

# 제5호 나목 — 상반기 평가: 책임자 1 + 관리감독자 D01~D07 (7명). 하반기는 비워 둔다.
SCORES_MGR = "C01=10;C02=10;C03=9;C04=8;C05=9;C06=10;C07=9;C08=8;C09=10"
R(clause_no="5", mok="나", record_kind="반기 평가", title="안전보건관리책임자 2026 상반기 업무수행 평가",
  target_role="안전보건관리책임자", target_ref="SOR-002", done_at="2026-06-25", checker_staff_id="SM01-1",
  score="83", item_scores=SCORES_MGR, content="산업재해 통계 기록 보완 필요 · 교육 계획 양호",
  ceo_reported="Y", reported_at="2026-07-02", report_method="대면 보고", created_by="SM01-1")
SUP = [("D01", 88), ("D02", 91), ("D03", 72), ("D04", 85), ("D05", 79), ("D06", 90), ("D07", 86)]
for i, (d, sc) in enumerate(SUP):
    n = int(d[1:])
    R(clause_no="5", mok="나", record_kind="반기 평가", title="관리감독자 2026 상반기 업무수행 평가",
      target_role="관리감독자", target_ref="SOR-%03d" % (32 + n), target_staff_id="SD%02d-1" % n, dept_id=d,
      done_at="2026-06-26", checker_staff_id="SM01-1", score=str(sc),
      content=("작업장 정리·정돈 확인 기록이 적음" if sc < 80 else "양호"),
      action_needed=("도로 포장 보수 현장 통로 확보 확인을 주 1회 기록할 것" if d == "D03" else ""),
      ceo_reported="Y", reported_at="2026-07-02", report_method="대면 보고", created_by="SM01-1")

# 제7호 — 상반기 반기 점검 + 3분기 위원회 논의(의견 청취 갈음, 보고 안 됨)
R(clause_no="7", record_kind="반기 점검", title="2026 상반기 종사자 의견 개선방안 이행 점검", target_ref="MAN-002",
  done_at="2026-06-26", checker_staff_id="SM01-1",
  content="접수 5건 중 개선방안 4건 이행 확인(난간 교체·그늘막·이동식 조명·비상벨)",
  action_needed="VOC-004 보호구 지급 주기 검토를 마칠 것", action_done_at="",
  ceo_reported="Y", reported_at="2026-07-02", report_method="대면 보고", created_by="SM01-1")
R(clause_no="7", record_kind="위원회 논의", title="산업안전보건위원회 3분기 정기회의", target_ref="SOR-004",
  done_at="2026-09-10", checker_staff_id="SM01-1", substitute="산업안전보건위원회",
  content="폭염기 휴게시간 기준 · 보호구 지급 주기 · 맨홀 작업 가스측정기 확보 심의",
  doc_name="산업안전보건위원회 회의록(2026년 3분기)", ceo_reported="", created_by="SM01-1")

# 제8호 — 매뉴얼 점검(훈련)
R(clause_no="8", record_kind="반기 점검", title="중대산업재해 대응 매뉴얼 상반기 훈련", target_ref="MAN-003",
  done_at="2026-03-27", checker_staff_id="SM02-1", covers="가·나",
  content="정수장 약품 누출을 가정한 작업 중지·대피·구호 훈련(참여 24명)",
  action_needed="추가 피해방지(다목) 절을 매뉴얼에 더할 것", action_done_at="",
  ceo_reported="Y", reported_at="2026-04-02", report_method="서면 보고", created_by="SM02-1")
R(clause_no="8", record_kind="반기 점검", title="폭염 작업중지·대피 기준 현장 점검", target_ref="MAN-004",
  done_at="2026-07-08", checker_staff_id="SM02-2", covers="가",
  content="체감온도 33도 이상 시 작업 중지 지시가 현장에서 지켜지는지 5개 현장 확인",
  ceo_reported="", created_by="SM02-2")

# ── eval_criteria (제5호 나목) ─────────────────────────────────────
CRIT_COLS = ["criteria_id", "target_role", "item_no", "item", "points", "law_basis", "active", "note"]
crit = []
MGR = [  # 산업안전보건법 제15조제1항 제1호~제9호
    ("사업장의 산업재해 예방계획 수립", 11), ("안전보건관리규정 작성·변경", 11), ("안전보건교육", 11),
    ("작업환경측정 등 작업환경 점검·개선", 11), ("건강진단 등 건강관리", 11),
    ("산업재해 원인 조사·재발 방지대책 수립", 11), ("산업재해 통계 기록·유지", 11),
    ("안전장치·보호구 구입 시 적격품 확인", 11), ("그 밖에 고용노동부령으로 정하는 유해·위험 방지조치", 12),
]
SUPV = [  # 같은 법 시행령 제15조제1항 제1호~제7호
    ("기계·기구·설비의 안전·보건 점검과 이상 유무 확인", 15), ("작업복·보호구·방호장치 점검과 착용·사용 교육·지도", 15),
    ("산업재해 보고와 응급조치", 15), ("작업장 정리·정돈과 통로 확보 확인·감독", 15),
    ("안전관리자·보건관리자 등의 지도·조언에 대한 협조", 10), ("위험성평가 유해·위험요인 파악과 개선조치 참여", 20),
    ("그 밖에 고용노동부령으로 정하는 사항", 10),
]
GEN = [  # 같은 법 시행령 제53조제1항 제1호~제5호
    ("위험성평가 실시", 20), ("작업의 중지(법 제51조·제54조)", 20), ("도급 시 산업재해 예방조치(법 제64조)", 20),
    ("산업안전보건관리비 사용 협의·조정과 집행 감독", 20), ("안전인증대상기계등·자율안전확인대상기계등 사용 여부 확인", 20),
]
for role, items, basis, pre in [
    ("안전보건관리책임자", MGR, "산업안전보건법 제15조제1항 제%d호", "C"),
    ("관리감독자", SUPV, "산업안전보건법 시행령 제15조제1항 제%d호", "S"),
    ("안전보건총괄책임자", GEN, "산업안전보건법 시행령 제53조제1항 제%d호", "G"),
]:
    for i, (it, pt) in enumerate(items, 1):
        crit.append(dict(criteria_id="%s%02d" % (pre, i), target_role=role, item_no=str(i), item=it, points=str(pt),
                         law_basis=basis % i, active="Y", note=EX + " · 배점은 기관이 정함"))
for role in ("안전보건관리책임자", "관리감독자", "안전보건총괄책임자"):
    s = sum(int(c["points"]) for c in crit if c["target_role"] == role)
    assert s == 100, (role, s)

# ── worker_voice (기존 5행 보존 + 칸 추가 + 예시 4행) ──────────────────
with io.open(SRC_VOICE, encoding="utf-8-sig") as f:
    old = list(csv.DictReader(f))
    OLD_COLS = list(old[0].keys())
assert len(old) == 5, len(old)
NEW_COLS = ["stage", "needs_improvement", "reviewed_at", "reviewer_staff_id", "plan", "plan_due",
            "plan_owner_staff_id", "done_at", "substitute", "ceo_reported", "reported_at", "report_method", "note"]
VOC_COLS = OLD_COLS + NEW_COLS
ADD = {  # 기존 행에 더하는 칸만(기존 값은 건드리지 않는다)
    "VOC-001": dict(stage="종결", needs_improvement="Y", reviewed_at="2026-06-15", reviewer_staff_id="SD01-2",
                    plan="파손 난간 교체", plan_due="2026-07-10", plan_owner_staff_id="SD01-2", done_at="2026-07-02"),
    "VOC-002": dict(stage="종결", needs_improvement="Y", reviewed_at="2026-06-28", reviewer_staff_id="SD02-2",
                    plan="현장 그늘막 설치", plan_due="2026-07-20", plan_owner_staff_id="SD02-2", done_at="2026-07-14"),
    "VOC-003": dict(stage="종결", needs_improvement="Y", reviewed_at="2026-07-08", reviewer_staff_id="SD03-2",
                    plan="이동식 조명 지급", plan_due="2026-07-31", plan_owner_staff_id="SD03-2", done_at="2026-07-26"),
    "VOC-004": dict(stage="검토", needs_improvement="", reviewed_at="", reviewer_staff_id="SD04-2"),
    "VOC-005": dict(stage="종결", needs_improvement="Y", reviewed_at="2026-07-30", reviewer_staff_id="SD05-2",
                    plan="비상벨 교체", plan_due="2026-08-20", plan_owner_staff_id="SD05-2", done_at="2026-08-19",
                    ceo_reported="Y", reported_at="2026-07-31", report_method="대면 보고"),
}
voice = []
for r in old:
    v = dict(r)
    v.update(ADD[r["voice_id"]])
    v["note"] = EX
    voice.append(v)
voice += [
    dict(voice_id="VOC-006", received_at="2026-08-12", channel="작업 전 안전점검 회의(TBM)", dept_id="D04",
         content="정수장 염소 투입 작업 방독마스크 정화통 교체 주기가 정해져 있지 않음", review_result="타당 — 교체 기준 필요",
         action_taken="", closed_at="", stage="개선방안", needs_improvement="Y", reviewed_at="2026-08-14",
         reviewer_staff_id="SD04-2", plan="정화통 교체 기준(사용 시간) 정하고 교체 대장 비치", plan_due="2026-09-15",
         plan_owner_staff_id="SD04-1", note=EX + " · 기한 넘김"),
    dict(voice_id="VOC-007", received_at="2026-09-03", channel="익명 신고함", dept_id="D05",
         content="맨홀 작업 때 가스측정기가 한 대뿐이라 동시 작업 시 측정을 건너뜀", review_result="긴급 — 추가 구입",
         action_taken="가스측정기 2대 추가 구입 발주", closed_at="", stage="이행", needs_improvement="Y",
         reviewed_at="2026-09-04", reviewer_staff_id="SD05-2", plan="가스측정기 2대 추가·작업 전 측정 기록",
         plan_due="2026-10-10", plan_owner_staff_id="SD05-1",
         ceo_reported="Y", reported_at="2026-09-05", report_method="대면 보고", note=EX),
    dict(voice_id="VOC-008", received_at="2026-09-10", channel="산업안전보건위원회", dept_id="D01",
         content="폭염기 옥외 작업 휴게시간 기준을 부서마다 다르게 운영함", review_result="",
         action_taken="", closed_at="", stage="검토", needs_improvement="", substitute="산업안전보건위원회", note=EX),
    dict(voice_id="VOC-009", received_at="2026-09-15", channel="현장 건의", dept_id="D03",
         content="터널 점검 통로 조명이 꺼져 있는 구간이 있음", review_result="", action_taken="", closed_at="",
         stage="접수", note=EX),
]

print("ops_v0.7 seed →", OUT)
wr("system_record", rec, REC_COLS)
wr("eval_criteria", crit, CRIT_COLS)
wr("worker_voice", voice, VOC_COLS)
