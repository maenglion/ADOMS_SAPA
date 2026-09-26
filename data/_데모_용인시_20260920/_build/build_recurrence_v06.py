# -*- coding: utf-8 -*-
"""
재발방지·개선명령 화면(/recurrence)용 예시 자료 — ops_v0.6 (2026-09-21)

뼈대: 중대재해처벌법 법 제4조제1항제2호·제3호 (산업) · 법 제9조제1항·제2항 제2호·제3호 (시민).
  원문 대조(정본 unit, DOC-000004):
    a4/p1/n2  "재해 발생 시 재발방지 대책의 수립 및 그 이행에 관한 조치"
    a4/p1/n3  "중앙행정기관ㆍ지방자치단체가 관계 법령에 따라 개선, 시정 등을 명한 사항의 이행에 관한 조치"
    a9/p1/n2·n3 · a9/p2/n2·n3 — 같은 문장
    a4/p2 — 시행령 위임은 제1항제1호·제4호뿐이다(제2호·제3호는 위임 없음).
  명령의 근거 조문은 정본 unit(R-20260920-10) 조문 제목·본문을 읽고 골랐다
    (산업안전보건법 제53조 · 화재예방법 제14조 · 소방시설법 제23조 · 재난안전법 제31조 ·
     수도법 제64조 · 실내공기질 관리법 제10조).

만드는 표 — 이 두 개만(같은 판 폴더에 다른 채팅 파일이 있다)
  · incident.csv        — ops_v0.2 의 2행을 그대로 옮기고 새 칸을 채움 + 예시 8행
  · order_received.csv  — ops_v0.2 의 6행을 그대로 옮기고 새 칸을 채움 + 예시 11행

옮겨 온 행의 확인 필요 사항(값은 고치지 않고 check_note 에 적는다)
  · INC-001·002 — 시설 번호(학교 교사동)와 사고 설명(하수처리시설·교량)이 맞지 않는다.
                  피해 「부상 1명」은 법 제2조제2호·제3호의 중대재해 정의에 못 미친다.
  · ORD-001~006 — 발령기관과 근거 법이 맞지 않는 조합이 있다(예: 소방서 · 산업안전보건법).

선택: --nil-seed 를 주면 반기 「재해 발생 이력 없음」 확인 예시(incident_nil_check.csv)도 만든다.
  (세 번째 파일이라 기본은 만들지 않는다.)

사용: python _build/build_recurrence_v06.py [--force] [--nil-seed]
  같은 이름의 CSV 가 있으면 멈춘다(판 덮어쓰기 금지). --force 로만 덮는다.
"""
import csv, io, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "ops_v0.2_20260920", "seed")
OUT = os.path.join(BASE, "ops_v0.6_20260921", "seed")
EX = "예시 자료(시연용)"
FORCE = "--force" in sys.argv
NIL = "--nil-seed" in sys.argv


def rd(name):
    with io.open(os.path.join(SRC, name + ".csv"), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def wr(name, rows, cols):
    p = os.path.join(OUT, name + ".csv")
    if os.path.exists(p) and not FORCE:
        sys.exit("멈춤: %s 가 이미 있다(판 덮어쓰기 금지). 발행 전 판이면 --force" % p)
    os.makedirs(OUT, exist_ok=True)
    with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            assert set(r) <= set(cols), (name, set(r) - set(cols))
            assert "예시" in r.get("note", ""), (name, r)
            w.writerow({c: r.get(c, "") for c in cols})
    print("  %-26s %4d행" % (name + ".csv", len(rows)))
    return len(rows)


# 참조 확인 — 없는 staff_id · asset_id · dept_id 를 쓰지 않는다.
def ids(folder, table, col):
    p = os.path.join(BASE, folder, "seed", table + ".csv")
    with io.open(p, encoding="utf-8-sig") as f:
        return {r[col] for r in csv.DictReader(f)}


STAFF = ids("ops_v0.3_20260921", "staff", "staff_id")
ASSET = ids("ops_v0.1_20260920", "asset", "asset_id")
DEPT = ids("ops_v0.1_20260920", "org_dept", "dept_id")

# ── incident ─────────────────────────────────────────────────────
INC_OLD = ["incident_id", "occurred_at", "disaster_type", "asset_id", "dept_id", "summary", "cause",
           "casualties", "recurrence_plan", "plan_due", "plan_done_at", "note"]
INC_NEW = ["event_class", "event_area", "serious", "accident_type", "place", "basis_clause",
           "reported_by", "owner_staff_id",
           "cause_due", "investigated_at", "investigated_by", "cause_evidence",
           "plan_set_due", "plan_set_at", "plan_set_by", "plan_evidence",
           "done_note", "done_evidence", "done_by",
           "effect_due", "effect_checked_at", "effect_checked_by", "effect_result", "effect_note", "effect_evidence",
           "related_order_id", "check_note"]
INC_COLS = INC_OLD + INC_NEW

B_IND = "법 제4조제1항제2호"
B_CIV = "법 제9조제2항제2호"
B_NEAR = "법정 대상 아님 — 예방 기록(위험성평가 반영)"

old_inc = {r["incident_id"]: r for r in rd("incident")}
assert set(old_inc) == {"INC-001", "INC-002"}, old_inc.keys()

inc_fill = {
    "INC-001": dict(
        event_class="산업재해", event_area="산업", serious="확인 필요", accident_type="추락",
        basis_clause=B_IND, reported_by="SD01-1", owner_staff_id="SD01-1",
        cause_due="2026-01-30", investigated_at="2026-01-29", investigated_by="SD01-1",
        cause_evidence="사고조사보고서_INC-001.pdf",
        plan_set_due="2026-02-13", plan_set_at="2026-02-10", plan_set_by="SM01-1",
        plan_evidence="재발방지대책_결재문서_INC-001.pdf",
        done_note="안전난간 설치 완료 · 작업 전 위험성평가 절차 시행", done_evidence="안전난간_보수_사진대지.pdf",
        done_by="SD01-2",
        effect_due="2026-06-14", effect_checked_at="2026-06-10", effect_checked_by="SM01-1",
        effect_result="유효", effect_note="3개월간 같은 작업에서 추락 위험 지적 0건",
        effect_evidence="효과확인_현장점검표_202606.pdf",
        related_order_id="ORD-001",
        check_note="시설 번호(고기초등학교 교사동)와 사고 설명(하수처리시설)이 맞지 않음 · "
                   "피해 「부상 1명」은 법 제2조제2호 중대산업재해 정의에 못 미침 — 원 기록 대조 필요"),
    "INC-002": dict(
        event_class="시민재해", event_area="시민", serious="확인 필요", accident_type="시설물 파손",
        basis_clause=B_CIV, reported_by="SD02-1", owner_staff_id="SD02-1",
        cause_due="2026-05-30", investigated_at="2026-05-29", investigated_by="SD02-1",
        cause_evidence="교량난간_파손_조사서.pdf",
        plan_set_due="2026-06-06", plan_set_at="2026-06-05", plan_set_by="SM02-1",
        plan_evidence="교량난간_일제점검_계획.pdf",
        check_note="시설 번호(두창초등학교 교사1호동)와 사고 설명(도로 교량)이 맞지 않음 · "
                   "피해 「부상 1명」은 법 제2조제3호 중대시민재해 정의에 못 미침 — 원 기록 대조 필요"),
}

incidents = []
for k in ["INC-001", "INC-002"]:
    r = dict(old_inc[k])
    r["note"] = (r.get("note") or "") + " · " + EX
    r.update(inc_fill[k])
    incidents.append(r)

N = lambda **kw: dict(note=EX, **kw)
incidents += [
    N(incident_id="INC-003", occurred_at="2026-07-08", disaster_type="산업재해", event_class="산업재해",
      event_area="산업", serious="해당 안 됨", accident_type="끼임",
      asset_id="ST2005-0000048", dept_id="D04", place="슬러지 탈수기실",
      summary="슬러지 탈수기 점검 중 회전부에 손가락 끼임(가상)",
      cause="점검 전 전원 차단·잠금 절차 미이행 · 회전부 덮개를 떼어 둔 채 운전",
      casualties="부상 1명(손가락 골절, 치료 4주)", basis_clause=B_IND,
      reported_by="SD04-2", owner_staff_id="SD04-1",
      cause_due="2026-07-15", investigated_at="2026-07-14", investigated_by="SD04-1",
      cause_evidence="사고조사보고서_기흥레스피아_0708.pdf",
      plan_set_due="2026-07-24", plan_set_at="2026-07-24", plan_set_by="SM02-1",
      recurrence_plan="탈수기 회전부 덮개 연동장치 설치 · 전원 차단·잠금 절차서 개정 및 전 직원 교육",
      plan_evidence="재발방지대책_기흥레스피아.pdf", plan_due="2026-09-30",
      related_order_id="ORD-007"),
    N(incident_id="INC-004", occurred_at="2026-08-19", disaster_type="아차사고", event_class="아차사고",
      event_area="산업", serious="해당 안 됨", accident_type="질식(위험)",
      asset_id="ST2010-0000022", dept_id="D04", place="유입 맨홀",
      summary="맨홀 진입 직전 가스 측정기 경보 — 황화수소 농도 높음, 진입 중지(가상)",
      cause="", casualties="없음", basis_clause=B_NEAR,
      reported_by="SD04-2", owner_staff_id="SD04-2", cause_due="2026-08-26"),
    N(incident_id="INC-005", occurred_at="2026-07-22", disaster_type="시민 피해 사고", event_class="시민재해",
      event_area="시민", serious="해당 안 됨", accident_type="낙하물",
      asset_id="TU2009-0000101", dept_id="D03", place="터널 상행 조명부",
      summary="터널 조명등 1기 낙하 — 주행 차량 앞유리 파손, 인명 피해 없음(가상)",
      cause="조명 고정 볼트 부식 · 정기점검표에 조명 고정부 항목이 없음",
      casualties="인명 피해 없음 · 차량 1대 파손", basis_clause=B_CIV + " — 공중이용시설 해당 여부 확인 전",
      reported_by="SD03-2", owner_staff_id="SD03-1",
      cause_due="2026-07-29", investigated_at="2026-07-29", investigated_by="SD03-1",
      cause_evidence="청명터널_조명낙하_조사서.pdf",
      plan_set_due="2026-08-07", plan_set_at="2026-08-07", plan_set_by="SM02-2",
      recurrence_plan="터널 조명 전수 고정 상태 점검 · 정기점검표에 조명 고정부 항목 추가",
      plan_evidence="터널조명_전수점검_계획.pdf", plan_due="2026-10-31"),
    N(incident_id="INC-006", occurred_at="2026-09-12", disaster_type="아차사고", event_class="아차사고",
      event_area="시민", serious="해당 안 됨", accident_type="넘어짐",
      asset_id="BR2006-0002077", dept_id="D03", place="보도육교 남측 계단",
      summary="계단 미끄럼방지재 탈락 — 보행자가 미끄러질 뻔함(시민 신고)(가상)",
      cause="", casualties="없음", basis_clause=B_NEAR,
      reported_by="SD03-2", owner_staff_id="SD03-2", cause_due="2026-09-19",
      related_order_id="ORD-014"),
    N(incident_id="INC-007", occurred_at="2026-03-15", disaster_type="산업재해", event_class="산업재해",
      event_area="산업", serious="해당 안 됨", accident_type="비래(튀는 물체)",
      asset_id="", dept_id="D06", place="기흥호수공원 산책로 예초 구간",
      summary="예초기 작업 중 튄 돌에 눈 부상(가상)",
      cause="보안경 미착용 · 비산방지망 미사용",
      casualties="부상 1명(각막 찰과상, 치료 2주)", basis_clause=B_IND,
      reported_by="SD06-2", owner_staff_id="SD06-1",
      cause_due="2026-03-22", investigated_at="2026-03-20", investigated_by="SD06-1",
      cause_evidence="예초작업_사고조사서.pdf",
      plan_set_due="2026-03-29", plan_set_at="2026-03-27", plan_set_by="SM02-1",
      recurrence_plan="예초 작업 보안경 지급·착용 확인 · 이동식 비산방지망 사용 의무화",
      plan_evidence="예초작업_안전수칙_개정.pdf", plan_due="2026-04-30",
      plan_done_at="2026-04-24", done_by="SD06-1", done_note="보안경 40개 지급 · 비산방지망 6조 구입·배치",
      done_evidence="보안경_지급대장.pdf",
      effect_due="2026-07-31", effect_checked_at="2026-07-15", effect_checked_by="SM02-2",
      effect_result="유효", effect_note="하절기 예초 작업 현장 3회 확인 — 착용률 100%",
      effect_evidence="효과확인_예초현장_202607.pdf",
      related_order_id="ORD-017"),
    N(incident_id="INC-008", occurred_at="2026-08-05", disaster_type="아차사고", event_class="아차사고",
      event_area="시민", serious="해당 안 됨", accident_type="추락(위험)",
      asset_id="AR2003-0006407", dept_id="D09", place="2층 관람석",
      summary="관람석 안전난간 흔들림 — 이용자가 기대다 넘어질 뻔함(가상)",
      cause="난간 앵커 볼트 풀림 · 월 점검 항목에 흔들림 확인 없음",
      casualties="없음", basis_clause=B_NEAR,
      reported_by="SD09-2", owner_staff_id="SD09-1",
      cause_due="2026-08-12", investigated_at="2026-08-08", investigated_by="SD09-1",
      cause_evidence="실내체육관_난간_조사서.pdf",
      plan_set_due="2026-08-19", plan_set_at="2026-08-12", plan_set_by="SM02-2",
      recurrence_plan="관람석 난간 앵커 재고정 · 월 1회 흔들림 점검 항목 추가",
      plan_evidence="관람석난간_보수계획.pdf", plan_due="2026-09-05",
      plan_done_at="2026-09-03", done_by="SD09-1", done_note="앵커 48개소 재고정 · 점검표 개정",
      done_evidence="난간보수_사진대지_0903.pdf", effect_due="2026-10-05",
      related_order_id="ORD-009"),
    N(incident_id="INC-009", occurred_at="2026-09-03", disaster_type="산업재해", event_class="산업재해",
      event_area="산업", serious="해당 안 됨", accident_type="근골격계",
      asset_id="", dept_id="D12", place="재활용 선별장",
      summary="폐기물 포대 반복 운반 중 허리 부상(가상)",
      cause="중량물 운반 보조기구 없음 · 2인 1조 운반 기준 없음",
      casualties="부상 1명(요추 염좌, 치료 3주)", basis_clause=B_IND,
      reported_by="SD12-2", owner_staff_id="SD12-1",
      cause_due="2026-09-10", investigated_at="2026-09-10", investigated_by="SD12-1",
      cause_evidence="선별장_근골격계_조사서.pdf",
      plan_set_due="2026-09-17"),
    N(incident_id="INC-010", occurred_at="2025-11-10", disaster_type="아차사고", event_class="아차사고",
      event_area="산업", serious="해당 안 됨", accident_type="끼임",
      asset_id="ST2005-0000048", dept_id="D04", place="슬러지 탈수기실",
      summary="탈수기 청소 중 회전부에 장갑이 말려 들어갈 뻔함(가상)",
      cause="청소 중 설비 정지 확인 절차 없음", casualties="없음", basis_clause=B_NEAR,
      reported_by="SD04-2", owner_staff_id="SD04-1",
      cause_due="2025-11-17", investigated_at="2025-11-14", investigated_by="SD04-1",
      plan_set_due="2025-11-24", plan_set_at="2025-11-21", plan_set_by="SM02-1",
      recurrence_plan="회전부 청소 전 설비 정지 확인 · 경고 표지 부착",
      plan_due="2025-12-10", plan_done_at="2025-12-05", done_by="SD04-2",
      done_note="경고 표지 부착 · 정지 확인 구두 교육", done_evidence="경고표지_부착사진.pdf",
      effect_due="2026-02-28", effect_checked_at="2026-02-10", effect_checked_by="SM02-1",
      effect_result="유효", effect_note="3개월간 같은 유형 보고 없음"),
]

# ── order_received ───────────────────────────────────────────────
ORD_OLD = ["order_id", "received_at", "issuer", "law", "content", "due_date", "dept_id", "asset_id",
           "done_at", "result", "evidence_file"]
ORD_NEW = ["issuer_kind", "law_article", "order_no", "place", "owner_staff_id", "assigned_at",
           "action_plan", "started_at", "done_note", "done_by",
           "reported_at", "report_evidence", "closed_at", "closed_note",
           "extended_due", "extend_reason", "related_incident_id", "check_note", "note"]
ORD_COLS = ORD_OLD + ORD_NEW

old_ord = {r["order_id"]: r for r in rd("order_received")}
assert set(old_ord) == {"ORD-00%d" % i for i in range(1, 7)}, old_ord.keys()

MISMATCH = "발령기관과 근거 법이 맞지 않는 조합 — 원 공문 대조 필요"
ord_fill = {
    "ORD-001": dict(issuer_kind="중앙행정기관", owner_staff_id="SD01-1", assigned_at="2026-04-24",
                    action_plan="난간 보수 업체 선정 · 임시 출입통제", started_at="2026-04-28",
                    related_incident_id="INC-001",
                    check_note="근거 조문 미기재 · 시설 번호와 내용 확인 필요 — 원 공문 대조 필요"),
    "ORD-002": dict(issuer_kind="중앙행정기관", owner_staff_id="SD02-1", assigned_at="2026-05-14",
                    action_plan="정밀안전진단 용역 발주", started_at="2026-05-20",
                    done_note="정밀안전진단 완료 · 결과보고서 접수", done_by="SD02-1",
                    reported_at="2026-06-25", report_evidence="정밀안전진단_결과보고_공문.pdf",
                    closed_at="2026-07-10", closed_note="발령기관 이행 확인 공문 접수",
                    check_note="근거 조문 미기재 — 원 공문 대조 필요"),
    "ORD-003": dict(issuer_kind="지방자치단체", owner_staff_id="SD03-1", assigned_at="2026-06-03",
                    action_plan="소화설비 정비 업체 긴급 발주", started_at="2026-06-08",
                    done_note="소화설비 정비 완료", done_by="SD03-1",
                    reported_at="2026-07-15", report_evidence="소방시설_정비결과_보고.pdf",
                    check_note="화재예방법 조치명령 발령권자는 소방관서장(제14조) — " + MISMATCH),
    "ORD-004": dict(issuer_kind="지방자치단체", owner_staff_id="SD04-1", assigned_at="2026-06-23",
                    action_plan="방화문 도어클로저 교체 견적", started_at="2026-06-30",
                    check_note=MISMATCH),
    "ORD-005": dict(issuer_kind="중앙행정기관", owner_staff_id="SD05-1", assigned_at="2026-07-13",
                    action_plan="안전난간 보수", started_at="2026-07-15",
                    done_note="안전난간 보수 완료", done_by="SD05-1",
                    reported_at="2026-08-25", report_evidence="난간보수_결과보고.pdf",
                    closed_at="2026-09-05", closed_note="발령기관 현장 확인",
                    check_note=MISMATCH),
    "ORD-006": dict(issuer_kind="중앙행정기관", owner_staff_id="SD06-1", assigned_at="2026-08-03",
                    action_plan="정밀안전진단 용역 발주", started_at="2026-08-07",
                    done_note="정밀안전진단 완료", done_by="SD06-1",
                    check_note=MISMATCH),
}

orders = []
for k in sorted(old_ord):
    r = dict(old_ord[k])
    r.update(ord_fill[k])
    r["note"] = "옮겨 온 행 · " + EX
    orders.append(r)

O = lambda **kw: dict(note=EX, **kw)
orders += [
    O(order_id="ORD-007", received_at="2026-07-15", issuer="고용노동부(근로감독)", issuer_kind="중앙행정기관",
      law="산업안전보건법", law_article="산업안전보건법 제53조제1항", order_no="근로감독-2026-0715(가상)",
      content="슬러지 탈수기 회전부 방호덮개 설치 등 시정조치 명령", due_date="2026-08-14",
      dept_id="D04", asset_id="ST2005-0000048", owner_staff_id="SD04-1", assigned_at="2026-07-16",
      action_plan="회전부 덮개 연동장치 설치 · 시정조치 명령 사항 게시(제53조제2항)", started_at="2026-07-20",
      done_at="2026-08-12", result="조치 완료", done_note="연동장치 2대 설치 · 명령 사항 게시", done_by="SD04-1",
      evidence_file="방호덮개_설치사진.pdf", reported_at="2026-08-13", report_evidence="시정조치_완료보고_공문.pdf",
      closed_at="2026-08-28", closed_note="근로감독관 현장 확인", related_incident_id="INC-003"),
    O(order_id="ORD-008", received_at="2026-09-08", issuer="고용노동부(근로감독)", issuer_kind="중앙행정기관",
      law="산업안전보건법", law_article="산업안전보건법 제53조제1항", order_no="근로감독-2026-0908(가상)",
      content="재활용 선별장 컨베이어 비상정지장치 설치 시정조치 명령", due_date="2026-09-25",
      dept_id="D12", place="재활용 선별장", owner_staff_id="SD12-1", assigned_at="2026-09-08",
      action_plan="비상정지 스위치 4개소 설치 발주", started_at="2026-09-10", result="조치 중"),
    O(order_id="ORD-009", received_at="2026-08-20", issuer="용인소방서", issuer_kind="지방자치단체",
      law="화재의 예방 및 안전관리에 관한 법률", law_article="화재의 예방 및 안전관리에 관한 법률 제14조제1항",
      order_no="용인소방-2026-0820(가상)",
      content="화재안전조사 결과 피난통로 적치물 제거 · 유도등 보수 조치명령", due_date="2026-09-19",
      dept_id="D09", asset_id="AR2003-0006407", owner_staff_id="SD09-1", assigned_at="2026-08-21",
      action_plan="적치물 즉시 제거 · 유도등 12개 교체 발주", started_at="2026-08-25", result="조치 중",
      extended_due="2026-10-10", extend_reason="유도등 부품 조달 지연 — 기간연장 신청·승인(같은 법 제45조, 가상)",
      related_incident_id="INC-008"),
    O(order_id="ORD-010", received_at="2026-06-10", issuer="용인서부소방서", issuer_kind="지방자치단체",
      law="소방시설 설치 및 관리에 관한 법률", law_article="소방시설 설치 및 관리에 관한 법률 제23조제6항",
      order_no="서부소방-2026-0610(가상)",
      content="자체점검 이행계획(스프링클러 헤드 교체) 미완료 — 이행 명령", due_date="2026-07-31",
      dept_id="D09", asset_id="AR2003-0009584", owner_staff_id="SD09-2", assigned_at="2026-06-11",
      action_plan="스프링클러 헤드 36개 교체", started_at="2026-06-20",
      done_at="2026-07-28", result="조치 완료", done_note="헤드 36개 교체 · 작동 시험", done_by="SD09-2",
      evidence_file="스프링클러_교체_사진대지.pdf", reported_at="2026-07-30", report_evidence="이행계획_완료결과_보고서.pdf",
      closed_at="2026-08-12", closed_note="소방서 완료 확인"),
    O(order_id="ORD-011", received_at="2026-09-01", issuer="경기도", issuer_kind="지방자치단체",
      law="재난 및 안전관리 기본법", law_article="재난 및 안전관리 기본법 제31조제1항",
      order_no="경기도-안전-2026-0901(가상)",
      content="긴급안전점검 결과 터널 배수로 막힘·누수 보수 안전조치 명령", due_date="2026-10-15",
      dept_id="D03", asset_id="TU2009-0000144", owner_staff_id="SD03-1", assigned_at="2026-09-02",
      action_plan="이행계획서 제출(제31조제2항) · 배수로 준설 · 누수 보수", started_at="2026-09-07", result="조치 중"),
    O(order_id="ORD-012", received_at="2026-08-28", issuer="기후에너지환경부(한강유역환경청)", issuer_kind="중앙행정기관",
      law="수도법", law_article="수도법 제64조제4항", order_no="한강청-2026-0828(가상)",
      content="정수시설 운영·관리 개선 명령(여과지 역세척 설비)", due_date="2026-09-27",
      dept_id="D04", asset_id="WS2003-0000053", owner_staff_id="SD04-2", assigned_at="2026-08-28",
      action_plan="역세척 펌프 교체 · 운영 매뉴얼 개정 (1개월 이내 이행 — 같은 조 제5항)", started_at="2026-09-01",
      result="조치 중"),
    O(order_id="ORD-013", received_at="2026-07-02", issuer="수지구청", issuer_kind="지방자치단체",
      law="실내공기질 관리법", law_article="실내공기질 관리법 제10조", order_no="수지구-환경-2026-0702(가상)",
      content="국공립어린이집 실내공기질(이산화탄소) 유지기준 초과 — 환기설비 개선명령", due_date="2026-08-31",
      dept_id="D07", place="수지구 소재 국공립어린이집(가상)", owner_staff_id="SD07-1", assigned_at="2026-07-03",
      action_plan="환기설비 용량 증설", started_at="2026-07-10",
      done_at="2026-09-04", result="조치 완료", done_note="환기설비 2대 증설 · 재측정 기준 이내", done_by="SD07-1",
      evidence_file="실내공기질_재측정성적서.pdf", reported_at="2026-09-05", report_evidence="개선명령_이행보고.pdf"),
    O(order_id="ORD-014", received_at="2026-09-17", issuer="경기도", issuer_kind="지방자치단체",
      law="재난 및 안전관리 기본법", law_article="재난 및 안전관리 기본법 제31조제1항",
      order_no="경기도-안전-2026-0917(가상)",
      content="보도육교 계단 미끄럼방지 시설 보수 안전조치 명령", due_date="2026-10-15",
      dept_id="D03", asset_id="BR2006-0002077", result="접수", related_incident_id="INC-006"),
    O(order_id="ORD-015", received_at="2026-05-20", issuer="고용노동부(근로감독)", issuer_kind="중앙행정기관",
      law="산업안전보건법", law_article="산업안전보건법 제53조제1항", order_no="근로감독-2026-0520(가상)",
      content="밀폐공간 작업 전 산소·유해가스 측정기 비치 시정조치 명령", due_date="2026-06-19",
      dept_id="D04", asset_id="ST2010-0000022", owner_staff_id="SD04-2", assigned_at="2026-05-21",
      action_plan="복합가스 측정기 6대 구입 · 측정 기록 양식 도입", started_at="2026-05-25",
      done_at="2026-06-15", result="조치 완료", done_note="측정기 6대 비치 · 작업 전 측정 기록 시작", done_by="SD04-2",
      evidence_file="가스측정기_구입·비치대장.pdf", reported_at="2026-06-17", report_evidence="시정조치_완료보고.pdf",
      closed_at="2026-07-01", closed_note="근로감독관 서면 확인"),
    O(order_id="ORD-016", received_at="2026-09-18", issuer="용인소방서", issuer_kind="지방자치단체",
      law="화재의 예방 및 안전관리에 관한 법률", law_article="화재의 예방 및 안전관리에 관한 법률 제14조제1항",
      order_no="용인소방-2026-0918(가상)",
      content="화재안전조사 결과 방화셔터 작동 불량 개수 명령", due_date="2026-10-18",
      dept_id="D09", asset_id="AR2005-0002918", owner_staff_id="SD09-2", assigned_at="2026-09-19", result="접수"),
    O(order_id="ORD-017", received_at="2026-07-20", issuer="고용노동부(근로감독)", issuer_kind="중앙행정기관",
      law="산업안전보건법", law_article="산업안전보건법 제53조제1항", order_no="근로감독-2026-0720(가상)",
      content="예초기 날 보호덮개 미부착 — 해당 기계 사용중지 및 개선 명령", due_date="2026-08-19",
      dept_id="D06", place="공원 예초 작업장", owner_staff_id="SD06-1", assigned_at="2026-07-21",
      action_plan="보호덮개 부착 · 미부착 예초기 사용 금지", started_at="2026-07-25", result="조치 중",
      related_incident_id="INC-007"),
]

# ── 반기 「재해 발생 이력 없음」 확인(선택) ───────────────────────
NIL_COLS = ["nil_id", "period", "dept_id", "confirmed_by", "confirmed_at", "memo", "note"]
nil_rows = []
for i, (period, d, by, at) in enumerate([
    ("2026-H1", "D03", "SD03-1", "2026-07-03"), ("2026-H1", "D04", "SD04-1", "2026-07-02"),
    ("2026-H1", "D07", "SD07-1", "2026-07-06"), ("2026-H1", "D08", "SD08-1", "2026-07-06"),
    ("2026-H1", "D09", "SD09-1", "2026-07-07"), ("2026-H1", "D10", "SD10-1", "2026-07-03"),
    ("2026-H1", "D12", "SD12-1", "2026-07-08"), ("2026-H1", "D13", "SD13-1", "2026-07-02"),
    ("2026-H1", "D14", "SD14-1", "2026-07-09"),
    ("2026-H2", "D07", "SD07-1", "2026-09-15"), ("2026-H2", "D08", "SD08-2", "2026-09-16"),
    ("2026-H2", "D10", "SD10-1", "2026-09-14"), ("2026-H2", "D13", "SD13-1", "2026-09-17"),
    # 확인한 뒤에 재해가 등록된 경우(화면에서 「확인 뒤 발생」으로 짚는다)
    ("2026-H2", "D12", "SD12-1", "2026-08-31"),
], 1):
    nil_rows.append(dict(nil_id="NIL-%03d" % i, period=period, dept_id=d, confirmed_by=by,
                         confirmed_at=at, memo="확인 시점까지 부서 내 재해 발생 없음", note=EX))

# ── 참조 검사 ────────────────────────────────────────────────────
for r in incidents:
    assert r["dept_id"] in DEPT, r["incident_id"]
    assert not r.get("asset_id") or r["asset_id"] in ASSET, r["incident_id"]
    for c in ("reported_by", "owner_staff_id", "investigated_by", "plan_set_by", "done_by", "effect_checked_by"):
        assert not r.get(c) or r[c] in STAFF, (r["incident_id"], c, r[c])
for r in orders:
    assert r["dept_id"] in DEPT, r["order_id"]
    assert not r.get("asset_id") or r["asset_id"] in ASSET, r["order_id"]
    for c in ("owner_staff_id", "done_by"):
        assert not r.get(c) or r[c] in STAFF, (r["order_id"], c, r[c])
for r in nil_rows:
    assert r["dept_id"] in DEPT and r["confirmed_by"] in STAFF, r
# 옮겨 온 칸은 한 글자도 바뀌지 않았다(note 는 「예시 자료」만 덧붙임)
for r in incidents[:2]:
    o = old_inc[r["incident_id"]]
    assert all(r[c] == o[c] for c in INC_OLD if c != "note"), r["incident_id"]
for r in orders[:6]:
    o = old_ord[r["order_id"]]
    assert all(r[c] == o[c] for c in ORD_OLD), r["order_id"]

print("ops_v0.6 — 재발방지·개선명령 예시 자료 →", OUT)
wr("incident", incidents, INC_COLS)
wr("order_received", orders, ORD_COLS)
if NIL:
    wr("incident_nil_check", nil_rows, NIL_COLS)
else:
    print("  (incident_nil_check.csv 는 만들지 않음 — --nil-seed)")
