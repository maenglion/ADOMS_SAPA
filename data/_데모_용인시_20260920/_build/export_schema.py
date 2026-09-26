# -*- coding: utf-8 -*-
"""
운영 DB 필드 대장 내보내기 (2026-09-21)

왜 만드는가
  운영 데이터의 칸이 여러 판에 흩어져 있다 — v0.1 DDL 13표, v0.2 추가 12표,
  v0.3 위험성평가 2표, v0.4 계약 칸 8개… 어디에 무슨 칸이 있는지 한눈에 보는 곳이 없었다.
  그래서 ① 적재 때 칸이 없어 멈추고(ceo_activity.note 사고) ② 만든 칸을 잊고 다시 만들고
  ③ 다른 채팅·외부 개발자가 무엇을 쓸 수 있는지 모른다.

사용자 지시(2026-09-21)
  「업무 이행과 관리에 필요한 필드들은 **삭제해달라고 요청하기 전까지 내보내기 형태로 계속 반영**해라.
    필요하면 추가하거나 없애면 되는데, 그 필드들은 남아 있어야 한다.」
  → 칸을 새로 만들면 다음 실행 때 대장에 자동으로 올라오고, 지우라는 말이 없는 한
    누적 DDL 에서 빠지지 않는다.

무엇을 내는가 (모두 `_스키마\\` 아래)
  1. (명세)운영DB_필드대장_<날짜>.html  — 표 × 칸 × 뜻 × 채움률 × 예시값 × 생긴 판
  2. (명세)운영DB_필드대장_<날짜>.csv   — 같은 내용을 표로(엑셀에서 열림)
  3. ops_cumulative.sql                 — v0.1~최신 판(DDL_FILES)을 합친 **지금 필드 전부**가 든 DDL 한 벌
     (09-21: v0.6·v0.7 추가 · checked_* 칸 누락·여러 칸 alter·do 블록 결재 칸 누락 정정 · 표별 뜻 MEANING_T)
  4. 점검 결과                          — CSV 에만 있는 칸 / DDL 에만 있는 칸

읽는 원천은 전부 실물이다. 손으로 적은 목록을 쓰지 않는다.
"""
import csv, io, os, re, sys, datetime as dt


def say(*a):
    """콘솔이 cp949 라도 죽지 않게 — 못 찍는 글자는 물음표로 바꾼다.
    산출물은 이미 다 만든 뒤라, 요약 출력 때문에 실패로 보이면 안 된다(09-21)."""
    line = " ".join(str(x) for x in a)
    enc = (sys.stdout.encoding or "utf-8")
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.encode(enc, "replace").decode(enc, "replace"))

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(BASE, "_build")
OUT = os.path.join(BASE, "_스키마")
os.makedirs(OUT, exist_ok=True)
TODAY = dt.date.today().isoformat().replace("-", "")
csv.field_size_limit(10 ** 8)

# DDL 파일 — 앞에서 뒤로 읽으며 쌓는다(뒤가 앞을 덮지 않고 더한다).
DDL_FILES = [
    ("v0.1", os.path.join(BASE, "ops_v0.1_20260920", "01_schema.sql")),
    ("v0.1", os.path.join(BASE, "ops_v0.1_20260920", "02_views.sql")),
    ("v0.2", os.path.join(BUILD, "ops_v0.2_add.sql")),
    ("v0.3", os.path.join(BUILD, "ops_v03_v04_add.sql")),
    ("v0.5", os.path.join(BUILD, "ops_v05_add.sql")),
    ("v0.6", os.path.join(BUILD, "ops_v06_add.sql")),
    ("v0.7", os.path.join(BUILD, "ops_v07_add.sql")),
    ("v0.8", os.path.join(BUILD, "ops_v08_add.sql")),   # 09-22 원료·제조물 대장 · 재해 발생 직후 대응 등(여러 생성기가 덧붙임)
]

# 표마다 뜻이 다른 칸 — 공통 MEANING 보다 먼저 본다(2026-09-21 v0.6·v0.7 등록 때 추가).
MEANING_T = {
    ("drill_plan", "status"): "진행 상태(계획·준비·실시·평가 완료)",
    ("drill_plan", "method"): "훈련 방식(실행기반·토론기반·도상+실제)",
    ("drill_plan", "done_at"): "훈련 실시일",
    ("drill_plan", "place"): "훈련 장소",
    ("drill_plan", "participants"): "참여 인원",
    ("civil_manual", "participants"): "참석 인원",
    ("civil_manual", "done_at"): "실시일",
    ("system_record", "done_at"): "실시일",
    ("worker_voice", "done_at"): "개선 이행 완료일",
    ("hazard_report", "done_at"): "처리 완료일",
    ("training_record", "status"): "이수 상태(이수·미실시)",
    ("training_check", "method"): "점검 방식(직접 점검·점검 결과 보고받음)",
    ("training_check", "summary"): "점검 결과 요약",
    ("training_check", "period"): "점검 기간(반기 또는 연)",
    ("annual_schedule", "source"): "출처 자료(쪽·표 번호)",
    ("contract_eval_item", "source"): "출처 자료(쪽 번호)",
    ("contract_eval_score", "result"): "합격·미달",
    ("contract_eval_score", "note"): "평가 메모",
    ("incident", "place"): "발생 장소",
    ("order_received", "place"): "대상 장소",
    ("order_received", "result"): "처리 상태(접수·조치 중·조치 완료·종결)",
    ("safety_org_role", "method"): "선임 방식(직접·겸직·위탁)",
    ("safety_org_role", "status"): "선임·지정 상태",
    ("contract_compliance", "status"): "준수 여부(이행·보완필요·미이행·해당없음)",
    ("hazard_step", "at"): "처리 일시",
    ("audit_log", "action"): "한 일(insert·update·approve·reject)",
    ("drill_plan", "target_name"): "훈련 대상 이름",
    ("asset_target_map", "basis"): "대응 근거(FMS 구분·종류 규칙 등)",
    ("contract_compliance", "item_no"): "관리의무 항목 번호(1~4)",
    ("contract_compliance", "item_code"): "관리의무 항목 코드",
    ("contract_mgmt_item", "item_no"): "관리의무 항목 번호(1~4)",
    ("contract_mgmt_item", "item_code"): "관리의무 항목 코드(E4-9-GA 등)",
    ("contract_mgmt_item", "item_name"): "관리의무 항목 이름",
    ("contract_mgmt_item", "basis"): "근거 조문",
    ("inspection_batch", "requested_at"): "결재 상신 일시",
    ("inspection_batch", "requested_by"): "결재 상신한 사람",
    ("safety_manual", "manual_id"): "절차·매뉴얼 번호",
    ("contract_hazard_map", "hazard_id"): "계약 위험요인 번호",
}

# 칸 이름 → 우리말 뜻. 모르는 칸은 빈칸으로 두고 대장에 「뜻 미기재」로 표시한다.
MEANING = {
    "task_id": "과제 번호", "assign_id": "배정 번호", "duty_key": "의무 열쇠(정본)",
    "period_label": "주기 표시", "due_date": "기한", "status": "이행 상태",
    "done_at": "이행 완료일", "done_by": "이행한 사람", "remark": "비고",
    "approval_status": "결재 상태(작성중·제출·승인·반려)", "submitted_at": "제출 일시",
    "submitted_by": "제출한 사람", "approved_at": "승인 일시", "approved_by": "승인한 사람",
    "rejected_at": "반려 일시", "reject_reason": "반려 사유", "created_at": "만든 일시",
    "created_by": "만든 사람", "period_year": "연도", "half_year": "반기",
    "plan_date": "계획일", "evidence_cnt": "증빙 수",
    "check_result": "점검 판정(이행완료·보완필요·미이행)",
    "entered_in_demo": "시연 중 입력분 표시",
    "evidence_id": "증빙 번호", "evidence_kind": "증빙 종류", "file_name": "파일 이름",
    "file_url": "파일 주소", "form_id": "법정 서식 번호", "uploaded_by": "올린 사람",
    "uploaded_at": "올린 날짜",
    "insp_id": "점검 번호", "inspector_staff_id": "점검자", "insp_date": "점검일",
    "result": "판정 결과", "finding": "점검 의견·지적사항",
    "action_id": "조치 번호", "action_type": "조치 구분(보완·시정)",
    "notif_id": "알림 번호", "notif_type": "알림 종류(기한임박·기한초과)",
    "to_staff_id": "받는 사람", "sent_at": "보낸 날짜", "message": "알림 내용", "read_at": "읽은 일시",
    "dept_id": "부서 번호", "dept_name": "부서 이름", "dept_role": "부서 역할(총괄·관리·현업)",
    "parent_dept_id": "상위 부서",
    "staff_id": "담당자 번호", "display_name": "담당자 이름",
    "duty_role": "역할(정담당·부담당·점검팀장 등)", "email": "전자우편", "phone": "전화",
    "asset_id": "자산 번호", "asset_name": "자산 이름", "asset_gbn": "시설 구분",
    "asset_kind": "시설 종류", "asset_class": "종별(1·2·3종)", "safety_grade": "안전등급",
    "completed_ymd": "준공일", "addr": "소재지", "source": "출처(FMS 등)",
    "sapa_l2_result": "중처법 판정", "sapa_basis": "판정 근거", "need_data": "더 필요한 자료",
    "verified": "확인 여부",
    "target_code": "관리대상 코드", "target_name": "관리대상 이름",
    "scope": "적용 범위(자산·유형)", "applicability": "해당 여부", "applicability_note": "해당 여부 메모",
    "cycle": "주기", "cycle_days": "주기(일)", "decided_by": "정한 사람", "decided_at": "정한 날짜",
    "owner_staff_id": "정담당", "deputy_staff_id": "부담당", "badge": "화면 표시(배지)",
    "contract_id": "계약 번호", "contract_name": "계약 이름", "counterpart": "수급인(업체)",
    "contract_type": "계약 구분(공사·용역·위탁·물품)", "start_date": "계약 시작",
    "end_date": "계약 종료", "amount": "계약 금액", "safety_clause": "안전보건 확보 조항 유무",
    "evaluation_done": "수급인 안전보건 수준평가 실시 여부",
    "contract_method": "계약 방식(제한경쟁·수의계약 등)", "trade": "업종",
    "safety_cost": "산업안전보건관리비", "worker_cnt": "투입 인원",
    "subcontract": "재하도급 여부", "eval_score": "수급인 평가 점수", "eval_date": "평가 실시일",
    "manager_staff_id": "계약 담당",
    "hazard_id": "위험요인 번호", "hazard_place": "장소", "hazard_factor": "위험요인",
    "risk_level": "위험도(높음·보통·낮음)", "measure": "조치",
    "cduty_id": "계약 의무 번호",
    "risk_id": "위험성평가 번호", "title": "제목", "place": "현장", "method": "평가 방법",
    "assessed_at": "평가 실시일", "assessor_staff_id": "평가자",
    "worker_joined": "종사자 참여 여부", "review_cycle": "재검토 주기", "next_due": "다음 평가 기한",
    "risk_item_id": "위험요인 항목 번호", "hazard_kind": "위험 유형",
    "measure_due": "조치 기한", "measure_done_at": "조치 완료일",
    "activity_id": "활동 번호", "activity_date": "활동일", "activity_type": "활동 유형",
    "participants": "참석자", "instruction": "지시사항", "follow_up_task_id": "후속 과제",
    "evidence_file": "증빙 파일",
    "budget_id": "예산 번호", "fiscal_year": "회계연도", "budget_kind": "용도",
    "planned_amount": "편성액", "executed_amount": "집행액",
    "training_id": "교육 번호", "course_name": "과정명", "hours": "시간",
    "trained_at": "이수일", "certificate_file": "수료증",
    "voice_id": "의견 번호", "received_at": "접수일", "channel": "접수 경로",
    "content": "내용", "review_result": "검토 결과", "action_taken": "조치 내용", "closed_at": "종결일",
    "incident_id": "사고 번호", "occurred_at": "발생 일시", "disaster_type": "재해 구분",
    "summary": "개요", "cause": "원인", "casualties": "인명 피해",
    "recurrence_plan": "재발방지 대책", "plan_due": "대책 기한", "plan_done_at": "대책 완료일",
    "order_id": "명령 번호", "issuer": "발령 기관", "law": "근거 법령",
    "batch_id": "점검 회차 번호", "scope_dept_id": "주관 부서", "target_dept_ids": "대상 부서",
    "code36_list": "대상 의무조항", "started_by": "시행한 사람", "started_at": "시행일",
    "change_id": "개정 번호", "doc": "문서", "changed_kind": "개정 구분",
    "promulgated_at": "공포일", "effective_at": "시행일", "affected_duty_cnt": "영향 의무 수",
    "notice_sent_at": "알림 발송일",
    "form_id2": "", "schedule_kind": "별표·서식 구분", "schedule_no": "별표·서식 번호",
    "file_html": "서식 HTML", "file_docx": "서식 DOCX", "canon_release": "정본 발행판",
    "law_id": "법령 번호(정본)", "doc_id": "문서 번호(정본)", "unit_id": "조항호목 번호(정본)",
    "schedule_id": "별표·서식 번호(정본)", "obl_id": "의무 번호(정본)",
    "code36": "중처법 의무조항 36", "code36_name": "의무조항 이름",
    "area": "재해 구분(I 산업·F 시설교통·M 원료제조물)",
    "impl_type": "이행 유형 T01~T10", "impl_type_name": "이행 유형 이름",
    "law_group": "법령 그룹", "law_group_name": "법령 그룹 이름",
    "layer": "법령 계층(법률·대통령령·부령·고시)", "unit_label_ko": "조문(우리말 표기)",
    "article_title": "조 제목", "duty_name": "의무 이름", "verdict": "판정",
    "duty_subject": "수범주체", "cycle_text": "주기(원문)", "assign_basis": "배정 근거",
    "why": "왜 이 의무인가", "source_text": "조문 원문", "review_status": "검수 상태",
    "yongin_mark": "용인시 해당 표시", "task_name": "세부 이행업무",
    "sapa_clause": "확보의무 대분류", "sapa_clause_name": "확보의무 이름",
    "appl_path": "적용 경로", "note": "비고", "at": "일시", "action": "한 일",
    "target": "대상", "actor": "한 사람",
    # 09-21 v0.6·v0.7 등록 때 채움 — 「뜻 미기재」로 남던 칸
    "confidence": "대응 확신도(high·medium·low)", "updated_at": "고친 일시",
    "log_id": "기록 번호", "table_name": "표 이름", "row_key": "행 열쇠", "changed_by": "바꾼 사람",
    "changed_at": "바꾼 일시", "before_json": "바꾸기 전 값(JSON)", "after_json": "바꾼 뒤 값(JSON)",
    "cc_id": "준수여부 번호", "evidence_name": "증빙 이름",
    "hazard_code": "유해·위험요인 코드(18항목)", "hazard_name": "유해·위험요인 이름", "sort_no": "정렬 순서",
    "map_basis": "연결 근거(위험요인 문구 등)",
    "applies_to": "적용 범위", "basis_text": "근거 조문 원문", "evidence_hint": "증빙 예시",
    "plan_input_type": "계획 입력 유형(DATE_YM 연-월 · HALF_YEAR 반기)",
    "file_size": "파일 크기(바이트)", "mime_type": "파일 형식(MIME)", "file_type": "올린 파일 형식",
    "approve_note": "결재 의견", "return_reason": "돌려보낸 사유", "returned_at": "돌려보낸 일시",
    "n_ok": "상신 때 적합 수", "n_fix": "상신 때 보완필요 수", "n_bad": "상신 때 부적합 수",
    "n_open": "상신 때 조치 중 수", "n_unsubmitted": "상신 때 미제출 수",
    "from_staff_id": "보낸 사람", "designated_at": "선임·지정일", "role_id": "선임·지정 번호",
    "approver_role": "승인 직위", "policy_id": "경영방침·목표 번호", "posted_where": "게시한 곳",
}

RE_CREATE = re.compile(r"create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s*\((.*?)\n\);",
                       re.S | re.I)
RE_ALTER = re.compile(r"alter\s+table\s+([a-z_][a-z0-9_]*)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"
                      r"([a-z_][a-z0-9_]*)\s+([a-z0-9_\(\) ]+?)(?:\s+references[^;]*)?;", re.I)
RE_COL = re.compile(r"^\s*([a-z_][a-z0-9_]*)\s+([a-z][a-z0-9_ ]*(?:\([^)]*\))?)", re.I)
SKIP = ("primary", "foreign", "unique", "check", "constraint", "references")


# DDL 줄 끝 주석(`-- 뜻`)을 칸의 뜻으로 쓴다 — MEANING 에 없을 때만(2026-09-21).
#   DDL 을 쓰는 사람이 적은 뜻이 대장에 그대로 나오게 해 「뜻 미기재」를 줄인다.
DDL_NOTE = {}
# 같은 칸 이름이라도 표마다 뜻이 다르다 — (표, 칸) 으로도 둔다(09-21 v0.6·v0.7 등록 때 추가).
DDL_NOTE_T = {}
RE_LINE_NOTE = re.compile(r"^\s*(?:alter\s+table\s+\w+\s+add\s+column\s+if\s+not\s+exists\s+)?(?:add\s+column\s+if\s+not\s+exists\s+)?(\w+)\s+[\w\[\]() ]+?[,;]?\s*--\s*(.+?)\s*$", re.I)
RE_CTX = re.compile(r"^\s*(?:create\s+table\s+(?:if\s+not\s+exists\s+)?|alter\s+table\s+)(\w+)", re.I)


def meaning(c, t=None):
    """뜻 — ① 표별 고정 뜻 ② 공통 뜻 ③ 그 표 DDL 주석 ④ 다른 표 DDL 주석(같은 칸 이름)."""
    return (MEANING_T.get((t, c)) or MEANING.get(c) or DDL_NOTE_T.get((t, c))
            or DDL_NOTE.get(c, ""))


def _first_word(s):
    m = re.match(r"\s*([a-z_][a-z0-9_]*)", s, re.I)
    return m.group(1).lower() if m else ""


def parse_ddl():
    """DDL 을 훑어 {표: {칸: (자료형, 생긴 판)}} 로 만든다."""
    tables, order = {}, []
    for ver, path in DDL_FILES:
        if not os.path.exists(path):
            say("  (없음) %s" % path)
            continue
        sql = io.open(path, encoding="utf-8").read()
        cur = None
        for ln in sql.splitlines():
            cx = RE_CTX.match(ln)
            if cx:
                cur = cx.group(1)
            m = RE_LINE_NOTE.match(ln)
            if m and m.group(1).lower() not in ("create", "table", "set", "primary", "add") and not ln.strip().startswith("--"):
                DDL_NOTE.setdefault(m.group(1), m.group(2))
                if cur:
                    DDL_NOTE_T.setdefault((cur, m.group(1)), m.group(2))
        for m in RE_CREATE.finditer(sql):
            tname, body = m.group(1), m.group(2)
            t = tables.setdefault(tname, {})
            if tname not in order:
                order.append(tname)
            # ★ 한 줄에 컬럼이 여러 개 선언된 DDL 이 있다(`a date, b text,`).
            #   줄 단위로 끊으면 첫 컬럼만 읽혀 152개가 「CSV 에만 있음」으로 잘못 잡혔다(09-21 정정).
            #   주석을 걷어낸 뒤 **괄호 밖 쉼표**로 끊는다.
            clean = "\n".join(ln.split("--")[0] for ln in body.split("\n"))
            parts, depth, buf = [], 0, ""
            for ch in clean:
                if ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                if ch == "," and depth == 0:
                    parts.append(buf)
                    buf = ""
                else:
                    buf += ch
            parts.append(buf)
            for piece in parts:
                piece = piece.strip()
                # ★ 첫 낱말로만 거른다 — 전에는 startswith 라 checked_at·checked_by 가
                #   「check」 제약으로 잘못 걸러졌다(contract_compliance · 09-21 정정).
                if not piece or _first_word(piece) in SKIP:
                    continue
                c = RE_COL.match(piece)
                if c and c.group(1).lower() not in SKIP:
                    t.setdefault(c.group(1), (c.group(2).strip(), ver))
        # alter table — 주석을 걷고 문장(;) 단위로 읽는다.
        #   한 문장에 add column 이 여러 개인 것(ops_v0.2 compliance_task·evidence)도 읽는다(09-21 정정).
        nocomment = "\n".join(ln.split("--")[0] for ln in sql.split("\n"))
        for st in nocomment.split(";"):
            ma = re.match(r"\s*alter\s+table\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)\s+(.*)$", st, re.I | re.S)
            if not ma:
                continue
            tname = ma.group(1)
            for mc in re.finditer(r"add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s+([a-z][a-z0-9_]*(?:\s*\([^)]*\))?)",
                                  ma.group(2), re.I):
                t = tables.setdefault(tname, {})
                if tname not in order:
                    order.append(tname)
                t.setdefault(mc.group(1), (mc.group(2).strip(), ver))
        # do $$ … foreach t in array array['a','b'] … execute format('alter table %I add column if not exists x type …')
        #   ops_v0.2 의 공통 결재 칸(approval_status 등)이 여기 있다. 전에는 대장에서 빠졌다(09-21 정정).
        for blk in re.finditer(r"do\s+\$\$(.*?)\$\$", sql, re.I | re.S):
            body = blk.group(1)
            arr = re.search(r"array\s*\[([^\]]*)\]", body, re.I)
            if not arr:
                continue
            tnames = re.findall(r"'([a-z_][a-z0-9_]*)'", arr.group(1))
            cols = re.findall(r"add\s+column\s+if\s+not\s+exists\s+([a-z_][a-z0-9_]*)\s+([a-z][a-z0-9_]*)", body, re.I)
            for tname in tnames:
                t = tables.setdefault(tname, {})
                if tname not in order:
                    order.append(tname)
                for col, typ in cols:
                    t.setdefault(col, (typ, ver))
    return tables, order


def seed_dirs():
    """판 폴더를 **오래된 것부터** 돌려 어느 판에서 칸이 처음 나왔는지 본다."""
    return sorted(d for d in os.listdir(BASE) if d.startswith("ops_") and
                  os.path.isdir(os.path.join(BASE, d, "seed")))


# 테이블이 아닌 시드 — 다른 테이블을 갱신하는 패치 파일. 카탈로그에서 어긋남으로 세지 않는다.
PATCH_ONLY = {"task_approval_patch": "compliance_task 를 갱신하는 패치 파일(테이블 아님)"}


def scan_seeds():
    """시드 CSV 를 훑어 {표: {칸: (처음 나온 판, 채움률, 예시값)}}."""
    out = {}
    for d in seed_dirs():
        ver = d.split("_")[1]
        sdir = os.path.join(BASE, d, "seed")
        for f in sorted(os.listdir(sdir)):
            if not f.endswith(".csv"):
                continue
            tname = f[:-4]
            rows = list(csv.DictReader(io.open(os.path.join(sdir, f), encoding="utf-8-sig")))
            if not rows:
                continue
            t = out.setdefault(tname, {})
            for col in rows[0].keys():
                filled = [r.get(col) for r in rows if (r.get(col) or "").strip()]
                rate = round(len(filled) * 100 / len(rows))
                sample = (filled[0] if filled else "")[:34]
                prev = t.get(col)
                # 처음 나온 판은 지키고, 채움률·예시는 **가장 새 판** 값으로 갱신한다.
                t[col] = (prev[0] if prev else ver, rate, sample, len(rows), d)
    return out


def main():
    say("== DDL 읽기")
    tables, order = parse_ddl()
    say("   표 %d개" % len(tables))
    say("== 시드 CSV 읽기")
    seeds = scan_seeds()
    say("   판 %s · 표 %d개" % (", ".join(seed_dirs()), len(seeds)))

    # 화면이 어느 표를 쓰는지 — 앱 코드에서 실제로 찾는다.
    app = os.path.abspath(os.path.join(BASE, "..", "..", "..", "..",
                                       "20_개발", "_데모_용인시_20260920", "04_앱", "adoms2", "app"))
    used = {}
    if os.path.isdir(app):
        for root, _dirs, files in os.walk(app):
            for f in files:
                # 화면(.tsx)과 그 화면의 쓰기(actions.ts 등 .ts) — 09-21 부터 .ts 도 본다(쓰기만 하는 표가 빠졌다).
                if not f.endswith((".tsx", ".ts")):
                    continue
                src = io.open(os.path.join(root, f), encoding="utf-8").read()
                screen = os.path.relpath(root, app).replace("\\", "/")
                screen = "/" if screen == "." else "/" + screen
                for t in list(tables) + list(seeds):
                    if re.search(r"\b%s\b" % re.escape(t), src):
                        used.setdefault(t, set()).add(screen)

    allt = sorted(set(list(tables) + list(seeds)))
    rows_out, gaps = [], []
    for t in allt:
        cols = dict(tables.get(t, {}))
        sd = seeds.get(t, {})
        if t in PATCH_ONLY:
            for c, v in sd.items():
                rows_out.append({"표": t, "칸": c, "자료형": "(패치)", "생긴 판": v[0],
                                 "뜻": meaning(c, t), "채움률": "%d%%" % v[1],
                                 "예시값": v[2], "행수": v[3], "쓰는 화면": PATCH_ONLY[t]})
            continue
        for c in sd:
            if c not in cols:
                cols[c] = ("(DDL 없음)", sd[c][0])
                gaps.append(("CSV 에만 있음", t, c))
        for c in tables.get(t, {}):
            if sd and c not in sd:
                gaps.append(("DDL 에만 있음", t, c))
        for c, (typ, ver) in cols.items():
            s = sd.get(c)
            rows_out.append({
                "표": t, "칸": c, "자료형": typ, "생긴 판": s[0] if s else ver,
                "뜻": meaning(c, t), "채움률": ("%d%%" % s[1]) if s else "",
                "예시값": s[2] if s else "", "행수": s[3] if s else "",
                "쓰는 화면": " ".join(sorted(used.get(t, []))) or "",
            })

    # 1) CSV
    cpath = os.path.join(OUT, "(명세)운영DB_필드대장_%s.csv" % TODAY)
    cols = ["표", "칸", "자료형", "생긴 판", "뜻", "채움률", "예시값", "행수", "쓰는 화면"]
    with io.open(cpath, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows_out)

    # 2) 누적 DDL — 지금 필드 전부. 지우라는 말이 없는 한 여기서 빠지지 않는다.
    dpath = os.path.join(OUT, "ops_cumulative.sql")
    with io.open(dpath, "w", encoding="utf-8") as f:
        f.write("-- ADOMS 데모 2차 — 운영 DB 누적 DDL (자동 생성 %s)\n" % dt.date.today())
        f.write("-- 생성기 _build/export_schema.py · 손으로 고치지 않는다(다시 돌리면 덮어쓴다).\n")
        f.write("-- ★ 여기에는 v0.1~현재까지 **만들어진 칸 전부**가 들어 있다.\n")
        f.write("--   사용자가 지우라고 하기 전에는 어떤 칸도 빠지지 않는다(지시 2026-09-21).\n")
        f.write("create schema if not exists adoms2;\nset search_path to adoms2, public;\n\n")
        for t in allt:
            cols_t = dict(tables.get(t, {}))
            for c in seeds.get(t, {}):
                cols_t.setdefault(c, ("text", seeds[t][c][0]))
            if not cols_t:
                continue
            f.write("-- %s%s\n" % (t, ("  (%s)" % ", ".join(sorted(used.get(t, [])))) if used.get(t) else ""))
            f.write("create table if not exists %s (\n" % t)
            body = []
            for c, (typ, ver) in cols_t.items():
                ty = "text" if typ.startswith("(") else typ
                mean = meaning(c, t)
                body.append("  %-22s %-14s%s" % (c, ty, ("-- %s [%s]" % (mean, ver)) if mean else "-- [%s]" % ver))
            f.write(",\n".join(body) + "\n);\n\n")

    # 3) HTML
    hpath = os.path.join(OUT, "(명세)운영DB_필드대장_%s.html" % TODAY)
    by_t = {}
    for r in rows_out:
        by_t.setdefault(r["표"], []).append(r)
    H = ["""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>운영DB 필드 대장</title><style>
body{margin:0;background:#f7f7fa;color:#1e2124;font:15px/1.6 Pretendard,"Noto Sans KR","Malgun Gothic",system-ui,sans-serif}
header{background:#172b4d;color:#fff;padding:22px 28px}header h1{margin:0;font-size:24px}
header p{margin:7px 0 0;opacity:.82;font-size:14px}
main{max-width:1400px;margin:0 auto;padding:22px 28px 70px}
h2{font-size:18px;color:#003675;margin:26px 0 6px}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13.5px;margin:6px 0 14px}
th,td{border:1px solid #dce3ea;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#eef3f8;color:#003675;font-weight:700;font-size:13px}
td.c{white-space:nowrap}
.note{background:#e7f1f8;border:1px solid #cfe0ef;border-radius:9px;padding:13px 16px;font-size:14px}
.warn{background:#faf1e4;border:1px solid #e6d5ba;border-radius:9px;padding:13px 16px;font-size:14px;margin-top:12px}
.tag{display:inline-block;background:#f2f5f9;border:1px solid #e1e7ef;border-radius:5px;padding:1px 7px;font-size:12px;color:#3f4a5a}
.mut{color:#525c6b}
</style></head><body><header><h1>운영 DB 필드 대장</h1>
<p>자동 생성 {DATE} · 생성기 <code>_build/export_schema.py</code> · 손으로 고치지 않습니다</p></header><main>
<div class="note"><b>이 문서는 무엇인가</b><br>
데모 운영 DB 의 <b>모든 표와 칸</b>을 DDL·시드 CSV·앱 코드에서 <b>실제로 훑어</b> 만든 것입니다.
칸을 새로 만들면 다시 돌릴 때 자동으로 올라옵니다.
<b>사용자가 지우라고 하기 전에는 어떤 칸도 누적 DDL 에서 빠지지 않습니다</b>(지시 2026-09-21).<br>
같은 폴더의 <code>ops_cumulative.sql</code> 하나만 돌리면 지금 컬럼 전부가 든 스키마가 만들어집니다.</div>
""".replace("{DATE}", str(dt.date.today()))]
    if gaps:
        H.append('<div class="warn"><b>어긋난 칸 %d건</b><br>' % len(gaps))
        H.append("<br>".join("%s — <code>%s.%s</code>" % g for g in gaps[:40]))
        H.append("</div>")
    H.append('<p class="mut">표 %d개 · 칸 %d개</p>' % (len(by_t), len(rows_out)))
    for t in sorted(by_t):
        scr = used.get(t)
        H.append('<h2>%s %s</h2>' % (t, ('<span class="tag">%s</span>' % " ".join(sorted(scr))) if scr else ""))
        H.append("<table><thead><tr><th style='width:190px'>칸</th><th style='width:110px'>자료형</th>"
                 "<th style='width:74px'>생긴 판</th><th>뜻</th><th style='width:74px'>채움률</th>"
                 "<th style='width:230px'>예시값</th></tr></thead><tbody>")
        for r in by_t[t]:
            H.append("<tr><td class='c'><code>%s</code></td><td class='c'>%s</td><td class='c'>%s</td>"
                     "<td>%s</td><td class='c'>%s</td><td class='mut'>%s</td></tr>"
                     % (r["칸"], r["자료형"], r["생긴 판"],
                        r["뜻"] or "<span class='mut'>뜻 미기재</span>", r["채움률"],
                        (r["예시값"] or "").replace("<", "&lt;")))
        H.append("</tbody></table>")
    H.append("</main></body></html>")
    io.open(hpath, "w", encoding="utf-8").write("\n".join(H))

    say("\n== 냈다")
    say("  %s" % cpath)
    say("  %s" % hpath)
    say("  %s" % dpath)
    say("\n표 %d개 · 칸 %d개 · 어긋난 칸 %d건" % (len(by_t), len(rows_out), len(gaps)))
    for g in gaps[:12]:
        say("   · %s — %s.%s" % g)
    nomean = [r for r in rows_out if not r["뜻"]]
    if nomean:
        say("\n뜻이 안 적힌 칸 %d개 — MEANING 에 더하면 대장에 바로 나온다" % len(nomean))
        for r in nomean[:12]:
            say("   · %s.%s" % (r["표"], r["칸"]))


if __name__ == "__main__":
    main()
