"""
ops_v0.6 — 유해·위험요인 신고·조치 / 대피훈련 예시 자료 생성기 (2026-09-21)

근거 조문 (법령DB 원문 확인)
  · 중대재해처벌법 시행령 제10조제7호 가·나·라목 (DOC-000005 a10/n7/mga·mna·mra)
  · 시설물안전법 제24조제1항 (DOC-000030 a24/p1) · 같은 법 시행령 제19조 (DOC-000031 a19)
    — 「조치명령, 지정 또는 통보를 받은 날부터 1년 이내 착수 · 착수한 날부터 2년 이내 완료」(개정 2025.12.2)
    ★ 서울시 안내서(p.55)의 「2년 내 착수·3년 내 완료」는 옛 판 문구다. 이 자료는 현행 원문을 따른다.
  · 시설물안전법 제7조제1호 제1종시설물 (DOC-000030 a7/n1)

만드는 표 (다른 파일은 건드리지 않는다)
  seed/hazard_report.csv · seed/hazard_step.csv · seed/drill_plan.csv · seed/drill_eval.csv

실행: python build_hazard_drill_v06.py          (같은 이름이 있으면 멈춘다)
      python build_hazard_drill_v06.py --force  (덮어쓴다)
모든 행의 note 는 「예시 자료」. 사람은 기존 staff_id, 시설은 asset.csv 의 실제 시설.
"""
import csv
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "ops_v0.6_20260921", "seed")
FILES = ["hazard_report.csv", "hazard_step.csv", "drill_plan.csv", "drill_eval.csv"]


def find_seed(name):
    for d in sorted([x for x in os.listdir(ROOT) if x.startswith("ops_")], reverse=True):
        p = os.path.join(ROOT, d, "seed", name)
        if os.path.exists(p):
            return p
    raise SystemExit(f"{name} 없음")


def read(name):
    with open(find_seed(name), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


ASSET = {r["asset_id"]: r for r in read("asset.csv")}
STAFF = {r["staff_id"]: r for r in read("staff.csv")}


def A(aid):
    if aid not in ASSET:
        raise SystemExit(f"asset 없음: {aid}")
    return ASSET[aid]


def S(sid):
    if sid and sid not in STAFF:
        raise SystemExit(f"staff 없음: {sid}")
    return sid


def main_of(dept):
    return f"S{dept}-1"


def sub_of(dept):
    return f"S{dept}-2"


# ── 유해·위험요인 신고 ────────────────────────────────────────────
HZ_COLS = [
    "hz_id", "received_at", "channel", "channel_detail", "reporter", "received_by",
    "asset_id", "asset_name", "asset_gbn", "asset_class", "dept_id", "location", "description",
    "code_group", "code", "accident_type", "possible_accident", "photo_wide", "photo_close",
    "protect_action", "protect_at", "protect_by",
    "severity", "judged_by", "judged_at", "judge_memo",
    "minor_action", "closed_at", "closed_by", "notified_reporter", "notified_at",
    "ceo_reported_at", "ceo_report_mode", "ceo_reported_by", "ceo_instruction",
    "insp_at", "insp_by", "insp_result",
    "order_types", "order_at", "order_memo",
    "fsam_applies", "basis_date", "fix_items", "fix_budget", "fix_started_at", "fix_done_at",
    "done_at", "note",
]

# 경미 건 틀: (시설, 받은 때, 경로, 세부 경로, 위치, 설명, 코드군, 코드, 사고유형, 발생가능사고, 피해방지, 즉시조치, 진행단계)
#   진행단계: done=종결 · judged=판단까지 · protect=피해방지까지 · new=접수만
MINOR = [
    ("AR2005-0002918", "2026-03-04 09:20", "상시점검", "", "본청사 1층 민원실 출입구", "우천 시 출입구 바닥 대리석에 물기가 고여 미끄러움", "이용자 안전", "1 물리적", "넘어짐", "출입 시민 미끄러져 넘어짐", "미끄럼 주의 표지·흡수 매트 설치", "미끄럼 방지 매트 교체·우산 비닐 비치", "done"),
    ("AR2005-0002918", "2026-04-18 14:05", "직원 발견", "", "본청사 지하 2층 주차장 경사로", "경사로 연석 모서리 파손, 철근 노출", "시설물 안전", "4 주변시설", "부딪힘", "보행자 발 걸림·차량 접촉", "라바콘으로 구간 표시", "파손 연석 보수(모르타르)·모서리 보호대", "done"),
    ("AR2005-0003904", "2026-03-11 10:40", "시민 신고", "응답소", "문화예술원 대공연장 객석 3열 계단", "계단 끝 미끄럼 방지 논슬립 탈락", "이용자 안전", "1 물리적", "넘어짐", "관람객 계단에서 넘어짐", "해당 계단 통행 안내", "논슬립 재부착", "done"),
    ("AR2005-0003904", "2026-05-02 19:30", "상시점검", "", "문화예술원 무대 뒤 소품실", "소품 적재 높이 과다(2.5m), 고정 없음", "이용자 안전", "1 물리적", "맞음", "적재물 떨어져 작업자·출연자 맞음", "적재물 하향 정리", "선반 고정·적재 높이 1.5m 이하로 정리", "done"),
    ("AR2009-0002925", "2026-04-07 08:50", "상시점검", "", "시민체육센터 수영장 탈의실", "탈의실 바닥 배수 불량으로 물고임", "이용자 안전", "1 물리적", "넘어짐", "이용자 미끄러져 넘어짐", "미끄럼 주의 표지", "배수구 이물질 제거·배수 트랩 청소", "done"),
    ("AR2009-0002925", "2026-06-15 16:10", "시민 신고", "안전신문고", "시민체육센터 2층 헬스장", "러닝머신 비상정지 버튼 작동 안 됨", "이용자 안전", "3 전기적", "끼임", "운동 중 비상정지 불가로 끼임·넘어짐", "해당 기구 사용 중지 표지", "비상정지 스위치 교체", "done"),
    ("AR2003-0006407", "2026-05-20 11:00", "정기점검", "", "실내체육관 관람석 난간", "관람석 3층 난간 고정 볼트 2개 풀림", "시설물 안전", "3 부대시설", "떨어짐", "관람객 난간에 기대다 떨어짐", "해당 구간 관람석 사용 금지", "볼트 재체결·전 구간 조임 확인", "done"),
    ("AR2012-0000804", "2026-06-03 13:40", "시민 신고", "120", "수지문화복지타운 어린이 도서관 입구", "자동문 센서 반응 느려 어린이 손 끼일 뻔함", "이용자 안전", "1 물리적", "끼임", "자동문에 어린이 손·몸 끼임", "자동문 수동 개방 고정", "센서 감도 조정·끼임 방지 고무 부착", "done"),
    ("AR2012-0002015", "2026-07-08 10:15", "상시점검", "", "아르피아스포츠센터 기계실", "기계실 출입문 잠금장치 고장, 일반인 출입 가능", "이용자 안전", "3 전기적", "감전", "일반인 출입해 배전반 접촉", "출입문 임시 시건", "잠금장치 교체", "done"),
    ("AR2018-0002175", "2026-07-21 15:30", "직원 발견", "", "남사 스포츠센터 주차장 조명", "야간 주차장 조명 6개 중 4개 꺼짐", "이용자 안전", "5 기타", "기관 내 교통사고", "야간 보행자·차량 접촉", "임시 조명 설치", "안정기 교체", "done"),
    ("BR2006-0002077", "2026-03-19 07:40", "시민 신고", "120", "시청앞보도육교 계단 상판", "계단 디딤판 모서리 파손", "시설물 안전", "2 건축마감", "넘어짐", "보행자 발 걸려 넘어짐", "파손 계단 표시", "디딤판 보수", "done"),
    ("BR2002-0000963", "2026-04-02 18:20", "시민 신고", "안전신문고", "상갈보도육교 엘리베이터", "엘리베이터 문 닫힘 속도 빠름", "이용자 안전", "1 물리적", "끼임", "노약자 문에 끼임", "이용 주의 안내문 부착", "승강기 유지관리업체 점검·문 속도 조정", "done"),
    ("BR2004-0003232", "2026-06-26 09:00", "상시점검", "", "신갈보도육교 난간", "난간 도장 박리·부식 진행", "시설물 안전", "2 건축마감", "기타", "부식 진행 시 난간 강도 저하", "", "녹 제거·재도장(정기 보수 반영)", "done"),
    ("BR1999-0000607", "2026-08-11 11:30", "시민 신고", "응답소", "고매육교 상판 배수구", "배수구 막혀 빗물 고임, 겨울철 결빙 우려", "시설물 안전", "3 부대시설", "넘어짐", "결빙 구간 보행자 넘어짐", "", "배수구 준설", "done"),
    ("TU2006-0000031", "2026-05-13 06:30", "정기점검", "", "법화터널 상행 입구부 조명", "입구부 조명 3기 소등", "시설물 안전", "3 부대시설", "기관 외 교통사고", "터널 진입 시 명암 차로 추돌", "", "조명 등기구 교체", "done"),
    ("TU2009-0000102", "2026-07-02 14:20", "직원 발견", "", "기흥터널 비상주차대", "비상주차대 소화기 2개 압력 미달", "이용자 안전", "2 화학적", "화재", "차량 화재 시 초기 소화 실패", "", "소화기 교체", "done"),
    ("UR2006-0000017", "2026-06-29 17:50", "직원 발견", "", "신일지하차도 배수로 덮개", "배수로 그레이팅 1개 들뜸", "시설물 안전", "3 부대시설", "기관 외 교통사고", "이륜차 바퀴 걸려 넘어짐", "라바콘 설치", "그레이팅 고정 볼트 교체", "done"),
    ("UR2010-0000038", "2026-08-05 10:10", "상시점검", "", "흥덕지하차도 보도부", "보도 조명 커버 파손, 전선 일부 노출", "이용자 안전", "3 전기적", "감전", "보행자 노출 전선 접촉", "해당 조명 차단", "조명 커버 교체·절연 처리", "done"),
    ("WS1991-0000016", "2026-05-27 09:30", "정기점검", "", "용인상수도 약품동 계단", "약품동 계단 안전난간 높이 부족(90cm)", "이용자 안전", "1 물리적", "떨어짐", "작업자·견학자 계단에서 떨어짐", "견학 동선 변경", "난간 증고(120cm) 보강", "done"),
    ("WS2013-0000050", "2026-07-15 13:00", "상시점검", "", "청덕상수도 정수지 맨홀", "맨홀 뚜껑 잠금 미설치", "이용자 안전", "5 기타", "산소결핍", "무단 출입 시 밀폐공간 질식", "맨홀 임시 결속", "잠금형 맨홀 뚜껑 교체", "done"),
    ("AR2012-0000800", "2026-03-23 08:10", "시민 신고", "안전신문고", "기흥역사 2번 출입구 계단", "계단 미끄럼 방지 홈 마모, 비 오면 미끄러움", "이용자 안전", "1 물리적", "넘어짐", "승객 계단에서 넘어짐", "미끄럼 주의 표지", "미끄럼 방지 테이프 부착(임시)", "done"),
    ("AR2012-0000800", "2026-06-10 08:30", "시민 신고", "120", "기흥역사 2번 출입구 계단", "같은 계단에서 또 미끄러짐, 테이프 들뜸", "이용자 안전", "1 물리적", "넘어짐", "승객 계단에서 넘어짐", "미끄럼 주의 표지", "테이프 재부착", "done"),
    ("AR2012-0000800", "2026-09-08 07:55", "시민 신고", "응답소", "기흥역사 2번 출입구 계단", "비 오는 날 미끄러져 넘어질 뻔함(3번째 신고)", "이용자 안전", "1 물리적", "넘어짐", "승객 계단에서 넘어짐", "미끄럼 주의 표지·우천 시 매트", "", "judged"),
    ("AR2013-0001204", "2026-08-19 18:40", "시민 신고", "120", "신갈역사 승강장 스크린도어", "스크린도어 1개 개폐 지연", "이용자 안전", "1 물리적", "끼임", "승객 스크린도어에 끼임", "해당 문 사용 중지", "운영사 정비 요청·센서 교체", "done"),
    ("AR1982-0000084", "2026-09-02 10:00", "상시점검", "", "처인구청 본관 옥상 출입문", "옥상 출입문 상시 개방, 난간 낮음", "이용자 안전", "1 물리적", "떨어짐", "옥상 출입자 떨어짐", "옥상 출입문 시건", "", "protect"),
    ("AR2003-0009584", "2026-09-10 15:20", "직원 발견", "", "기흥구청사 3층 복도 천장", "천장 텍스 1장 처짐, 누수 흔적", "시설물 안전", "2 건축마감", "맞음", "천장재 떨어져 민원인 맞음", "하부 통행 통제", "", "protect"),
    ("AR1996-0002536", "2026-09-15 11:10", "시민 신고", "안전신문고", "용인시청소년수련원 야외 계단", "계단 옆 배수로 덮개 없음", "시설물 안전", "4 주변시설", "빠짐·익사", "어린이 배수로에 빠짐", "", "", "new"),
    ("AR2011-0000169", "2026-09-17 16:00", "시민 신고", "120", "백남준아트센터 야외 데크", "데크 목재 일부 썩어 꺼짐", "시설물 안전", "2 건축마감", "넘어짐", "관람객 발 빠져 넘어짐", "", "", "new"),
    ("BR2002-0000964", "2026-09-18 08:20", "정기점검", "", "새천년보도육교 조명", "야간 조명 전부 소등", "이용자 안전", "3 전기적", "기관 외 교통사고", "야간 보행자 넘어짐", "", "", "new"),
    ("AR2005-0003905", "2026-02-24 11:40", "상시점검", "", "복지센터 1층 경사로", "경사로 핸드레일 한쪽 없음", "이용자 안전", "1 물리적", "넘어짐", "휠체어·보행 보조기 이용자 넘어짐", "", "핸드레일 설치", "done"),
    ("AR2009-0002925", "2026-08-22 19:10", "시민 신고", "120", "시민체육센터 수영장 샤워실", "샤워실 바닥 타일 들뜸", "시설물 안전", "2 건축마감", "넘어짐", "이용자 미끄러져 넘어짐", "해당 구역 사용 중지", "타일 재시공", "done"),
    ("UR2006-0000030", "2026-07-11 05:40", "정기점검", "", "동백지하차도 배수펌프 제어반", "제어반 내부 결로·누전 차단기 동작", "이용자 안전", "3 전기적", "감전", "점검자 제어반 접촉 시 감전", "제어반 전원 차단·출입 통제", "제어반 방습 히터 설치·차단기 교체", "done"),
    ("RW2017-0000261", "2026-08-26 09:10", "상시점검", "", "용인미르스타디움 옹벽 상단 배수로", "배수로 토사 퇴적, 옹벽 상단 물넘침 흔적", "시설물 안전", "4 주변시설", "무너짐", "배수 불량으로 옹벽 배면 수압 증가", "", "배수로 준설", "done"),
]

# 심각 건 — 흐름 단계를 하나씩 다르게 둔다.
SERIOUS = [
    dict(aid="RW2011-0000080", at="2026-02-10 09:30", ch="정기점검", det="", loc="중로2-1옹벽 중앙부(연장 40~65m)",
         desc="옹벽 전면 배부름 현상과 수평 균열(폭 3~4mm) 확인, 배수공 막힘", grp="시설물 안전", code="4 주변시설",
         acc="무너짐", poss="옹벽 붕괴로 하부 보행자·차량 깔림", protect="하부 보도 통행 차단·우회 안내",
         judge="SM02-2", ceo_mode="구두 선보고 후 서면", ceo_h=2, instr="긴급안전점검 실시, 결과에 따라 보수·보강 계획 수립",
         insp="2026-02-20", insp_res="배부름 12mm, 균열폭 최대 4mm — 긴급 보수·보강 필요(중대한결함 해당)",
         order="보수·보강 · 이용제한(하부 보도)", fsam="Y", basis="2026-03-05",
         items="배수공 준설·추가 천공~42개소~1800~2026-04 | 균열 보수(에폭시 주입)~35m~2600~2026-05 | 앵커 보강~24공~9800~2026-06~07",
         budget="확보(재해예방 예비비)", start="2026-04-01", done="2026-08-28", stage="done"),
    dict(aid="SL2010-0000228", at="2025-09-20 07:10", ch="시민 신고", det="120", loc="10SS45D05400 절토사면 상단",
         desc="비 온 뒤 낙석 발생(주먹 크기 10여 개), 낙석방지망 일부 찢어짐", grp="시설물 안전", code="4 주변시설",
         acc="맞음", poss="낙석이 도로로 떨어져 차량·보행자 맞음", protect="하부 1개 차로 통제·낙석 주의 표지",
         judge="SM02-3", ceo_mode="서면", ceo_h=5, instr="긴급안전점검 후 우기 전 응급 조치",
         insp="2025-10-10", insp_res="암반 절리 발달, 낙석 위험 높음 — D등급 상당 판단, 보수·보강 필요",
         order="보수·보강 · 정밀안전진단", fsam="Y", basis="2025-10-15",
         items="낙석방지망 교체~450㎡~6300~2026-10 | 록볼트 보강~60공~12000~2027-03",
         budget="일부 확보(2027 본예산 요구)", start="", done="", stage="planned"),
    dict(aid="SL1980-0000026", at="2025-07-14 06:50", ch="정기점검", det="", loc="대대리 절토사면(산208) 중단부",
         desc="사면 중단부 인장균열·토사 유실", grp="시설물 안전", code="4 주변시설",
         acc="무너짐", poss="사면 붕괴로 도로 매몰", protect="도로변 감시원 배치·강우 시 통제",
         judge="SM02-3", ceo_mode="서면", ceo_h=20, instr="보수·보강 계획 수립, 다음 해 예산 반영",
         insp="2025-07-25", insp_res="표층 유실 진행 — 보수·보강 필요",
         order="보수·보강", fsam="Y", basis="2025-08-01",
         items="사면 녹화·배수로 설치~1200㎡~15000~2026 하반기",
         budget="미확보(2027 예산 요구 예정)", start="", done="", stage="planned"),
    dict(aid="UR2009-0000011", at="2026-09-20 06:40", ch="직원 발견", det="", loc="죽전지하차도 저점부 배수펌프장",
         desc="배수펌프 2대 중 1대 고장, 집중호우 시 침수 우려", grp="시설물 안전", code="3 부대시설",
         acc="빠짐·익사", poss="지하차도 침수로 차량 고립·익사", protect="호우 예보 시 진입 통제 준비·임시 양수기 배치",
         judge="SM02-2", ceo_mode="", ceo_h=None, instr="", insp="", insp_res="", order="", fsam="", basis="",
         items="", budget="", start="", done="", stage="judged"),
    dict(aid="TU2009-0000143", at="2026-09-05 10:20", ch="정기점검", det="", loc="영덕3터널 하행 180m 지점 천장",
         desc="천장 라이닝 표면 박리(0.5㎡), 누수 동반", grp="시설물 안전", code="1 주요 구조부",
         acc="맞음", poss="콘크리트 조각 떨어져 주행 차량 맞음", protect="하행 1개 차로 부분 통제",
         judge="SM02-2", ceo_mode="구두 선보고 후 서면", ceo_h=1, instr="긴급안전점검 즉시 실시",
         insp="2026-09-12", insp_res="박리 부위 추가 확인 3곳 — 보수 필요, 구조 안전성은 양호",
         order="보수·보강", fsam="N", basis="2026-09-15",
         items="", budget="", start="", done="", stage="ordered"),
    dict(aid="BR2013-0000319", at="2026-09-16 13:15", ch="시민 신고", det="안전신문고", loc="교량 신축이음부(A1 측)",
         desc="신축이음장치 고무 탈락, 단차 약 3cm", grp="시설물 안전", code="3 부대시설",
         acc="기관 외 교통사고", poss="이륜차 단차에 걸려 넘어짐·후속 추돌", protect="단차 구간 서행 표지·임시 복공판",
         judge="SM02-3", ceo_mode="서면", ceo_h=3, instr="긴급안전점검 실시", insp="", insp_res="",
         order="", fsam="", basis="", items="", budget="", start="", done="", stage="reported"),
    dict(aid="AR2018-0000223", at="2026-06-01 20:10", ch="상시점검", det="", loc="용인미르스타디움 동측 관람석 상단 난간",
         desc="관람석 최상단 난간 기초 앵커 부식·흔들림", grp="시설물 안전", code="3 부대시설",
         acc="떨어짐", poss="관람객 난간과 함께 떨어짐", protect="동측 상단 관람석 폐쇄",
         judge="SM02-2", ceo_mode="구두 선보고 후 서면", ceo_h=1, instr="경기 전 긴급 보수, 완료 전 해당 구역 판매 중지",
         insp="2026-06-04", insp_res="앵커 12개소 중 5개소 부식 — 교체 필요",
         order="이용제한 · 보수·보강", fsam="N", basis="2026-06-05",
         items="난간 앵커 교체~12개소~1450~2026-06",
         budget="확보(시설 유지보수비)", start="2026-06-10", done="2026-06-24", stage="done"),
]


def plus_h(at, h):
    from datetime import datetime, timedelta
    d = datetime.strptime(at, "%Y-%m-%d %H:%M") + timedelta(hours=h)
    return d.strftime("%Y-%m-%d %H:%M")


def plus_d(at, d):
    from datetime import datetime, timedelta
    x = datetime.strptime(at[:10], "%Y-%m-%d") + timedelta(days=d)
    return x.strftime("%Y-%m-%d")


def build_hazards():
    rows, steps = [], []
    n = 0

    def step(hz, kind, at, by, memo=""):
        steps.append({"step_id": f"HZS-{len(steps)+1:04d}", "hz_id": hz, "step": kind, "at": at, "by": by,
                      "memo": memo, "note": "예시 자료"})

    for (aid, at, ch, det, loc, desc, grp, code, acc, poss, protect, action, stage) in MINOR:
        n += 1
        a = A(aid)
        dept = a["dept_id"]
        hz = f"HZR-{n:04d}"
        recv = S(main_of(dept))
        reporter = "시민" if ch == "시민 신고" else STAFF[recv]["display_name"]
        r = {c: "" for c in HZ_COLS}
        r.update(hz_id=hz, received_at=at, channel=ch, channel_detail=det, reporter=reporter, received_by=recv,
                 asset_id=aid, asset_name=a["asset_name"], asset_gbn=a["asset_gbn"], asset_class=a["asset_class"],
                 dept_id=dept, location=loc, description=desc, code_group=grp, code=code, accident_type=acc,
                 possible_accident=poss, note="예시 자료")
        step(hz, "접수", at, recv, f"{ch}{' · ' + det if det else ''}")
        if stage in ("protect", "judged", "done") and protect:
            r.update(protect_action=protect, protect_at=plus_h(at, 1), protect_by=recv)
            step(hz, "피해방지조치", r["protect_at"], recv, protect)
        if stage in ("judged", "done"):
            jb = S(sub_of("D02") if n % 2 else "SM02-2")
            r.update(severity="경미", judged_by=jb, judged_at=plus_h(at, 3), judge_memo="현장 즉시 조치 가능")
            step(hz, "1차 판단", r["judged_at"], jb, "경미")
        if stage == "done":
            r.update(minor_action=action, closed_at=plus_d(at, 2 + n % 5), closed_by=recv,
                     notified_reporter="Y" if ch == "시민 신고" else "", notified_at=plus_d(at, 2 + n % 5) if ch == "시민 신고" else "",
                     done_at=plus_d(at, 2 + n % 5))
            step(hz, "즉시 조치·종결", r["closed_at"], recv, action)
            if ch == "시민 신고":
                step(hz, "신고자 통보", r["notified_at"], recv, "처리 결과 문자 통보")
        rows.append(r)

    for s in SERIOUS:
        n += 1
        a = A(s["aid"])
        dept = a["dept_id"]
        hz = f"HZR-{n:04d}"
        recv = S(main_of(dept))
        r = {c: "" for c in HZ_COLS}
        r.update(hz_id=hz, received_at=s["at"], channel=s["ch"], channel_detail=s["det"],
                 reporter="시민" if s["ch"] == "시민 신고" else STAFF[recv]["display_name"], received_by=recv,
                 asset_id=s["aid"], asset_name=a["asset_name"], asset_gbn=a["asset_gbn"], asset_class=a["asset_class"],
                 dept_id=dept, location=s["loc"], description=s["desc"], code_group=s["grp"], code=s["code"],
                 accident_type=s["acc"], possible_accident=s["poss"], note="예시 자료")
        step(hz, "접수", s["at"], recv, s["ch"])
        r.update(protect_action=s["protect"], protect_at=plus_h(s["at"], 1), protect_by=recv)
        step(hz, "피해방지조치", r["protect_at"], recv, s["protect"])
        r.update(severity="심각", judged_by=S(s["judge"]), judged_at=plus_h(s["at"], 2), judge_memo="구조 안전 우려 — 경영책임자 보고 대상")
        step(hz, "1차 판단", r["judged_at"], s["judge"], "심각")
        st = s["stage"]
        order = ["judged", "reported", "inspected", "ordered", "planned", "done"]
        lv = order.index(st)
        if lv >= 1:
            r.update(ceo_reported_at=plus_h(r["judged_at"], s["ceo_h"]), ceo_report_mode=s["ceo_mode"],
                     ceo_reported_by="SM01-1", ceo_instruction=s["instr"])
            step(hz, "경영책임자 보고", r["ceo_reported_at"], "SM01-1", f"{s['ceo_mode']} · 지시: {s['instr']}")
        if lv >= 2 and s["insp"]:
            r.update(insp_at=s["insp"], insp_by=S(main_of(dept)), insp_result=s["insp_res"])
            step(hz, "긴급안전점검", s["insp"], main_of(dept), s["insp_res"])
        if lv >= 3 and s["order"]:
            r.update(order_types=s["order"], order_at=plus_d(s["insp"], 1), order_memo=s["instr"],
                     fsam_applies=s["fsam"], basis_date=s["basis"])
            step(hz, "개선 지시", r["order_at"], "SM01-1", s["order"])
        if lv >= 4 and s["items"]:
            r.update(fix_items=s["items"], fix_budget=s["budget"], fix_started_at=s["start"])
            step(hz, "보수·보강 계획", s["basis"], main_of(dept), s["budget"])
            if s["start"]:
                step(hz, "보수·보강 착수", s["start"], main_of(dept), "")
        if lv >= 5:
            r.update(fix_done_at=s["done"], done_at=s["done"])
            step(hz, "완료", s["done"], main_of(dept), "보수·보강 완료")
        rows.append(r)
    return rows, steps


# ── 대피훈련 ───────────────────────────────────────────────────────
DR_COLS = [
    "drill_id", "target_key", "target_name", "target_kind", "asset_class", "legal_scope", "dept_id",
    "year", "half", "drill_type", "method", "planned_at", "place", "scenario", "target_minutes",
    "prep_coop", "prep_items", "prep_budget", "prep_memo", "carry_over",
    "r_cmd_main", "r_cmd_sub", "r_evac_main", "r_evac_sub", "r_resp_main", "r_resp_sub",
    "r_aid_main", "r_aid_sub", "r_eval_main", "r_eval_sub",
    "status", "done_at", "actual_minutes", "participants", "absent", "photos",
    "good_points", "shortfalls", "improvements",
    "substitute", "substitute_basis", "ceo_checked", "ceo_checked_at", "ceo_check_mode", "note",
]
LRT = ("LRT-EVERLINE", "용인경전철(에버라인)", "공중교통수단", "", "법정 대상", "D10")


def tgt(key):
    if key == "LRT":
        return LRT
    a = A(key)
    cls = a["asset_class"]
    if cls == "1종":
        scope = "법정 대상" if a["sapa_l2_result"] == "해당" else "법정 대상(공중이용시설 확인 필요)"
        kind = "제1종시설물"
    elif cls in ("2종", "3종"):
        scope, kind = "자체 확대", f"{cls}시설물"
    else:
        scope, kind = "확인 필요", "종별 확인 필요"
    return (key, a["asset_name"], kind, cls, scope, a["dept_id"])


# (대상, 연, 반기, 유형, 방법, 일시, 장소, 시나리오, 목표분, 상태, 실제분, 참여, 불참, 잘된점, 미흡, 개선, 갈음, 경영책임자확인, 이월)
DRILLS = [
    ("LRT", 2025, "하반기", "화재", "실행기반", "2025-11-12 14:00", "기흥역 승강장·전동차", "전동차 객실 화재 → 승객 대피·역사 밖 유도", 10, "평가 완료", 12, 46, 4,
     "운영사·소방서 합동으로 현장감 있게 진행", "목표 대피시간 2분 초과 · 안내방송 음량 작음", "승강장 안내방송 음량 개선 · 대피유도 인원 2명 추가", "Y", "Y", ""),
    ("LRT", 2026, "상반기", "지진", "실행기반", "2026-05-20 10:00", "시청·용인대역 구간 본선·역사", "규모 5.5 지진, 전동차 본선 정차 → 선로 보행 대피", 20, "평가 완료", 19, 52, 3,
     "선로 보행 대피 동선 숙지 양호", "고령 승객 대피 지원 인력 부족", "구호지원팀 인원 보강 · 휠체어 이송 장비 비치", "Y", "N", "승강장 안내방송 음량 개선 · 대피유도 인원 2명 추가"),
    ("LRT", 2026, "하반기", "화재", "실행기반", "2026-11-18 14:00", "전대·에버랜드역", "역사 매표소 화재 → 승객 대피", 10, "계획", "", "", "", "", "", "", "Y", "N", "구호지원팀 인원 보강 · 휠체어 이송 장비 비치"),
    ("TU2013-0000001", 2026, "상반기", "화재", "도상+실제", "2026-04-15 15:00", "본선터널(기흥~상갈) 비상대피로", "터널 내 전동차 화재 → 비상대피로로 승객 유도", 15, "평가 완료", 17, 28, 2,
     "비상대피로 개방 신속", "비상조명 일부 소등 · 터널 내 무선 교신 끊김", "비상조명 점검 주기 단축 · 무선 중계기 보강", "", "", ""),
    ("TU1994-0000016", 2026, "상반기", "화재", "실행기반", "2026-06-11 10:00", "마성터널(인천0) 피난연결통로", "터널 내 차량 화재 → 운전자 피난연결통로 대피", 8, "평가 완료", 7, 24, 1,
     "소방서·경찰서 교통통제 협업 우수", "피난연결통로 안내 표지 식별 어려움", "유도 표지 조도 개선", "", "", ""),
    ("TU1994-0000016", 2026, "하반기", "화재", "실행기반", "2026-10-22 10:00", "마성터널(강릉0)", "다중 추돌 후 차량 화재", 8, "준비", "", "", "", "", "", "", "", "", "유도 표지 조도 개선"),
    ("TU2006-0000031", 2025, "하반기", "화재", "토론기반", "2025-12-03 14:00", "도로과 회의실(도상)", "터널 입구부 탱크로리 화재", 10, "평가 완료", "", 12, 0,
     "관계기관 연락 체계 점검", "실제 대피 동선 미확인(도상만 실시)", "다음 훈련은 실행기반으로", "", "", ""),
    ("WS2003-0000053", 2026, "상반기", "위험물 누출", "실행기반", "2026-04-28 10:00", "용인시 지방상수도 약품동", "염소 저장실 누출 → 직원·견학자 대피", 6, "평가 완료", 6, 31, 0,
     "누출 감지기 연동 경보 정상", "방독면 착용 숙련도 편차", "분기 1회 보호구 착용 교육", "", "", ""),
    ("WS2003-0000053", 2026, "하반기", "지진", "토론기반", "2026-12-09 14:00", "상수도사업소 회의실", "지진으로 정수지 균열 · 단수 대응", 10, "계획", "", "", "", "", "", "", "", "", "분기 1회 보호구 착용 교육"),
    ("DA2008-0000007", 2026, "상반기", "침수", "도상+실제", "2026-06-24 14:00", "기흥저수지 제방·하류 산책로", "집중호우 → 제방 월류 우려, 하류 산책로 이용자 대피", 20, "평가 완료", 25, 18, 5,
     "주민 문자 발송 신속", "산책로 이용자 대피 안내 방송 미도달 구간", "하류 구간 방송 스피커 증설", "", "", ""),
    ("AR2018-0000223", 2026, "상반기", "지진", "실행기반", "2026-05-09 11:00", "용인미르스타디움 관람석", "경기 중 지진 → 관람객 운동장·외부 대피", 12, "평가 완료", 11, 140, 10,
     "관람석 구역별 대피 유도 원활", "동측 출입구 병목", "동측 출입구 개방 폭 확대 · 유도요원 추가 배치", "", "", ""),
    ("AR2018-0000223", 2026, "하반기", "화재", "실행기반", "2026-10-14 15:00", "용인미르스타디움 매점 구역", "매점 주방 화재 → 관람석 대피", 12, "계획", "", "", "", "", "", "", "", "", "동측 출입구 개방 폭 확대 · 유도요원 추가 배치"),
    ("UR2009-0000011", 2026, "상반기", "침수", "도상+실제", "2026-06-17 21:00", "죽전지하차도", "시간당 80mm 호우 → 진입 차단·고립 차량 운전자 대피", 10, "평가 완료", 13, 16, 2,
     "진입 차단기 원격 작동 확인", "야간 차단 인력 도착 지연", "야간 대기 인력 지정", "", "", ""),
    ("AR2012-0000800", 2026, "상반기", "화재", "실행기반", "2026-03-26 10:30", "기흥역사 대합실", "대합실 상가 화재 → 승객 대피", 8, "평가 완료", 9, 38, 2,
     "운영사 안내방송 신속", "비상구 앞 적치물", "비상구 적치물 상시 점검", "", "", ""),
    ("AR2005-0002918", 2026, "상반기", "화재", "실행기반", "2026-04-09 14:00", "용인시청 본청사", "지하 주차장 차량 화재 → 청사 전 층 대피", 15, "평가 완료", 14, 820, 60,
     "층별 대피 유도 원활", "민원인 대피 안내 부족", "민원실 안내 요원 지정", "", "", ""),
]
# 평가 점수(세부 12칸): 계획 10·10·5·5 / 인지전파 10·10 / 실시 10·10·5·5 / 평가개선 10·10
SCORES = {
    0: [10, 8, 5, 4, 7, 9, 6, 8, 4, 5, 10, 9],
    1: [10, 9, 5, 5, 9, 9, 10, 7, 5, 4, 10, 9],
    3: [9, 9, 4, 3, 8, 7, 7, 9, 5, 4, 9, 9],
    4: [9, 8, 5, 5, 9, 9, 10, 8, 4, 5, 9, 8],
    6: [8, 7, 4, 3, 6, 7, 0, 0, 5, 3, 8, 7],
    7: [10, 9, 5, 5, 10, 10, 10, 9, 5, 4, 9, 9],
    9: [9, 9, 4, 4, 7, 8, 6, 8, 4, 5, 9, 8],
    10: [10, 9, 5, 5, 9, 9, 10, 6, 4, 5, 10, 10],
    12: [9, 8, 5, 4, 8, 9, 7, 8, 4, 4, 9, 8],
    13: [9, 8, 5, 5, 9, 8, 8, 7, 5, 3, 9, 8],
    14: [10, 9, 5, 5, 9, 9, 10, 9, 4, 5, 10, 9],
}
EVAL_COLS = ["eval_id", "drill_id", "evaluator", "evaluated_at",
             "p1", "p2", "p3", "p4", "c1", "c2", "x1", "x2", "x3", "x4", "e1", "e2", "total", "comment", "note"]


def build_drills():
    rows, evals = [], []
    for i, d in enumerate(DRILLS):
        (key, yr, half, typ, meth, at, place, scen, tmin, status, amin, part, absn, good, short, imp, sub, ceo, carry) = d
        k, name, kind, cls, scope, dept = tgt(key)
        did = f"DRL-{i+1:04d}"
        r = {c: "" for c in DR_COLS}
        r.update(drill_id=did, target_key=k, target_name=name, target_kind=kind, asset_class=cls, legal_scope=scope,
                 dept_id=dept, year=str(yr), half=half, drill_type=typ, method=meth, planned_at=at, place=place,
                 scenario=scen, target_minutes=str(tmin), carry_over=carry,
                 prep_coop="완료" if status != "계획" else "미완료",
                 prep_items="완료" if status not in ("계획", "준비") else "미완료",
                 prep_budget="완료" if status != "계획" else "미완료",
                 prep_memo="소방서·경찰서 협조 공문 · 방송 원고 · 집결지 표지 · 구급함" if status != "계획" else "",
                 r_cmd_main=S(main_of(dept)), r_cmd_sub=S(sub_of(dept)),
                 r_evac_main=S(sub_of(dept)), r_evac_sub=S("SD02-2"),
                 r_resp_main=S("SD13-1"), r_resp_sub=S("SD13-2"),
                 r_aid_main=S("SD11-1"), r_aid_sub=S("SD11-2"),
                 r_eval_main=S("SM02-2"), r_eval_sub=S("SM02-3"),
                 status=status, note="예시 자료")
        if status == "계획" and i % 2 == 0:
            # 계획 단계에서는 임무카드 부담당을 아직 비워 둔 곳이 있다.
            r.update(r_aid_sub="", r_resp_sub="")
        if status == "평가 완료":
            r.update(done_at=at[:10], actual_minutes=str(amin), participants=str(part), absent=str(absn),
                     good_points=good, shortfalls=short, improvements=imp)
        if key == "LRT":
            r.update(substitute=sub, substitute_basis="철도안전법 제7조 비상대응계획(철도안전관리체계)",
                     ceo_checked=ceo, ceo_checked_at="2025-11-20" if ceo == "Y" else "",
                     ceo_check_mode="보고받음" if ceo == "Y" else "")
        rows.append(r)
        if i in SCORES and status == "평가 완료":
            sc = SCORES[i]
            e = {"eval_id": f"DRE-{len(evals)+1:04d}", "drill_id": did, "evaluator": "SM02-2",
                 "evaluated_at": plus_d(at, 3), "comment": f"잘된 점: {good} / 미흡: {short}", "note": "예시 자료"}
            for c, v in zip(["p1", "p2", "p3", "p4", "c1", "c2", "x1", "x2", "x3", "x4", "e1", "e2"], sc):
                e[c] = str(v)
            e["total"] = str(sum(sc))
            evals.append(e)
    return rows, evals


def write(name, cols, rows):
    with open(os.path.join(OUT, name), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)


def main():
    force = "--force" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    hit = [f for f in FILES if os.path.exists(os.path.join(OUT, f))]
    if hit and not force:
        raise SystemExit(f"이미 있다(덮으려면 --force): {', '.join(hit)}")
    hz, steps = build_hazards()
    dr, ev = build_drills()
    write("hazard_report.csv", HZ_COLS, hz)
    write("hazard_step.csv", ["step_id", "hz_id", "step", "at", "by", "memo", "note"], steps)
    write("drill_plan.csv", DR_COLS, dr)
    write("drill_eval.csv", EVAL_COLS, ev)
    print(f"hazard_report {len(hz)} · hazard_step {len(steps)} · drill_plan {len(dr)} · drill_eval {len(ev)}")


if __name__ == "__main__":
    main()
