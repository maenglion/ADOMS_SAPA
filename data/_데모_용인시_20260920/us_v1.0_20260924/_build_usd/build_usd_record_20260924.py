# -*- coding: utf-8 -*-
"""
[400 · 교육자료 버전] 묶음 D — 의무이행(실적증빙) 공중이용시설·공중교통수단 트랙 예시 행 생성기 (2026-09-24)

출력: ../seed/usd_record.csv  (앱: readTable("usd_record","rec_id"))
  한 행 = 화면 표의 한 줄. 단계(step) · 블록(block) · 대상(scope = 자산 id 또는 공중교통수단 id) 으로 묶는다.
  data  = 칸 값 JSON(칸 이름은 app/perform/fc/model.ts 의 COLS 와 같다)
  files = 증빙 파일 JSON {칸이름: [{name,url,at}]} — 예시 행은 파일 이름만 있고 url 은 비어 있다.

사람 이름은 직원 명부(staff.csv)의 가상 인물, 부서는 용인시 부서명. 유해·위험요인과 비상대피훈련 한 줄은
우리 예시 자료(hazard_report HZR-0016 · drill_plan DRL-0002)에서 옮겼다.
"""
import csv, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "seed", "usd_record.csv")

rows = []
n = [0]


def add(scope, dept, step, block, data, files=None, status=""):
    n[0] += 1
    f = {}
    for k, names in (files or {}).items():
        f[k] = [{"name": x, "url": "", "at": "2026-01-01T00:00:00"} for x in names]
    if not status:
        status = "이행완료" if any(f.values()) else ("해당없음" if data.get("na") == "Y" else "보완필요")
    rows.append({
        "rec_id": f"USD-S{n[0]:04d}", "scope": scope, "dept_id": dept, "year": "2026",
        "step": step, "block": block, "ord": str(n[0]), "deleted": "", "status": status,
        "data": json.dumps(data, ensure_ascii=False), "files": json.dumps(f, ensure_ascii=False),
        "updated_at": "2026-09-24", "updated_by": "",
    })


# ── 기흥터널(도로터널 1종 · 도로과(교량·터널)) ────────────────────────────
T, D = "TU2009-0000102", "D03"
add(T, D, "staff", "people", {"rank": "팀장", "date": "2026-01-02", "name": "서다혜", "dept": "안전총괄과", "note": "점검팀장(겸임)"})
add(T, D, "staff", "people", {"rank": "주무관", "date": "2026-01-02", "name": "정민준", "dept": "도로과(교량·터널)", "note": "정담당"},
    {"ev": ["기흥터널 안전 및 유지관리 인력현황표.xlsx"]})
add(T, D, "staff", "people", {"rank": "주무관", "date": "2026-01-02", "name": "강준호", "dept": "도로과(교량·터널)", "note": "부담당"})
add(T, D, "staff", "org", {"date": "2026-01-02", "note": "긴급상황 발생 시 조치체계도 포함"}, {"ev": ["기흥터널 안전 및 유지관리 조직도.PDF"]})
for item, plan, date, desc, ex, fn in [
    ("안전점검비", "18000", "2026-04-10", "정기안전점검 용역(상반기)", "8500", "정기안전점검_용역_지출결의서.pdf"),
    ("보수보강비", "42000", "2026-06-20", "터널 라이닝 균열 보수", "27300", "라이닝_균열보수_준공검사조서.pdf"),
    ("안전조치비", "6000", "2026-07-05", "비상주차대 소화기 교체", "300", "소화기_교체_지출결의서.pdf"),
    ("교육·훈련비", "2000", "2026-05-14", "터널 화재 대피훈련 물품 구입", "900", ""),
    ("기타", "1000", "", "", "0", ""),
]:
    add(T, D, "budget", "budget", {"item": item, "plan": plan, "date": date, "desc": desc, "exec": ex, "note": ""},
        {"ev": [fn]} if fn else None)
add(T, D, "inspect", "fsam", {"kind": "정기안전점검", "name": "2026년 상반기 정기안전점검", "date": "2026-04-10", "found": "3", "done": "2", "short": "1", "long": "0", "note": ""},
    {"ev": ["기흥터널_정기안전점검_결과보고서.pdf"]})
add(T, D, "inspect", "fsam", {"kind": "정밀안전점검", "name": "2025년 정밀안전점검", "date": "2025-10-20", "found": "5", "done": "4", "short": "0", "long": "1", "note": "장기 1건은 2026년 보수 예산 반영"},
    {"ev": ["기흥터널_정밀안전점검_결과보고서.pdf"]})
add(T, D, "inspect", "other", {"kind": "소방시설 작동점검", "ok": "Y", "name": "터널 소방시설 작동점검(소방시설 설치 및 관리에 관한 법률)", "date": "2026-03-18", "found": "2", "done": "2", "short": "0", "long": "0", "note": ""},
    {"ev": ["터널_소방시설_작동점검표.pdf"]})
add(T, D, "inspect", "other", {"kind": "전기설비 정기검사", "ok": "", "name": "터널 조명·환기 전기설비 정기검사(전기안전관리법)", "date": "2026-05-22", "found": "1", "done": "0", "short": "1", "long": "0", "note": "환기팬 제어반 접지 보완 중"})
add(T, D, "plan", "plan", {"item": "정기안전점검 반기 1회 실시", "date": "2026-04-10", "text": "상반기 정기안전점검 완료(지적 3건 중 2건 조치)", "note": ""},
    {"ev": ["기흥터널_정기안전점검_결과보고서.pdf"]})
add(T, D, "plan", "plan", {"item": "터널 방재설비(소화설비·비상조명) 월간 점검", "date": "2026-06-30", "text": "1~6월 월간 점검 완료", "note": ""})
add(T, D, "proc", "hazard", {"hz": "비상주차대 소화기 2개 압력 미달", "check": "기흥터널 비상주차대 — 직원 발견", "cdate": "2026-07-02", "act": "소화기 교체", "adate": "2026-07-05", "note": "HZR-0016"},
    {"ev": ["비상주차대_소화기_교체_사진.png"]})
add(T, D, "proc", "drill", {"name": "터널 화재 대피훈련", "date": "2026-05-14", "text": "도로과 자체 훈련 — 차량 운전자 대피 유도·비상방송", "note": ""},
    {"ev": ["터널_화재_대피훈련_결과서.pdf"]})
add(T, D, "proc", "flow1", {"mode": "pdf", "date": "2026-01-15"}, {"pdf": ["유해위험요인_신고_개선_절차도.pdf"]})
add(T, D, "proc", "flow2", {"mode": "pdf", "date": "2026-01-15"}, {"pdf": ["중대시민재해_대응조치_절차도.pdf"]})
add(T, D, "recur", "na", {"na": "Y"})
add(T, D, "order", "order", {"item": "정밀안전점검 지적사항(라이닝 균열) 보수", "org": "경기도", "date": "2026-02-10", "text": "균열 보수 완료 및 결과 보고", "from": "2026-02-15", "to": "2026-06-20", "note": ""},
    {"ev": ["개선시정_이행결과_보고.pdf"]})
add(T, D, "law", "lawA", {"duty_key": "DTY-00456", "date": "2026-04-10", "note": "상반기 정기안전점검"}, {"ev": ["기흥터널_정기안전점검_결과보고서.pdf"]})
add(T, D, "law", "lawA", {"duty_key": "DTY-00459", "date": "2026-04-30", "note": "점검 결과 보고"})
add(T, D, "law", "lawB", {"duty_key": "DTY-01652", "date": "2026-06-12", "note": "도로과 관계법령 교육"}, {"ev": ["관계법령_교육_이수증.pdf"]})

# ── 용인시 지방상수도(지방상수도 1종 · 상수도사업소) ─────────────────────────
W, D = "WS2003-0000053", "D04"
add(W, D, "staff", "people", {"rank": "팀장", "date": "2026-01-02", "name": "권성민", "dept": "안전총괄과", "note": "점검팀장(겸임)"})
add(W, D, "staff", "people", {"rank": "주무관", "date": "2026-01-02", "name": "조우진", "dept": "상수도사업소", "note": "정담당"},
    {"ev": ["지방상수도 안전 및 유지관리 인력현황표.xlsx"]})
add(W, D, "staff", "people", {"rank": "주무관", "date": "2026-01-02", "name": "윤재석", "dept": "상수도사업소", "note": "부담당"})
add(W, D, "staff", "org", {"date": "2026-01-02", "note": ""}, {"ev": ["용인시 지방상수도 안전 및 유지관리 조직도.PDF"]})
for item, plan, date, desc, ex in [
    ("안전점검비", "24000", "2026-05-08", "정수장 정기안전점검 용역", "11000"),
    ("보수보강비", "65000", "2026-08-01", "정수지 방수·배관 보수", "31000"),
    ("안전조치비", "8000", "", "", "0"),
    ("교육·훈련비", "3000", "2026-05-20", "수도시설 관리 교육", "1200"),
    ("기타", "0", "", "", "0"),
]:
    add(W, D, "budget", "budget", {"item": item, "plan": plan, "date": date, "desc": desc, "exec": ex, "note": ""})
add(W, D, "inspect", "fsam", {"kind": "정기안전점검", "name": "2026년 상반기 정기안전점검", "date": "2026-05-08", "found": "2", "done": "2", "short": "0", "long": "0", "note": ""},
    {"ev": ["지방상수도_정기안전점검_결과보고서.pdf"]})
add(W, D, "inspect", "other", {"kind": "수질검사", "ok": "Y", "name": "정수 수질검사(수도법)", "date": "2026-06-05", "found": "0", "done": "0", "short": "0", "long": "0", "note": "매월"})
add(W, D, "plan", "plan", {"item": "정수시설 운영관리 점검", "date": "2026-06-30", "text": "상반기 운영관리 점검 완료", "note": ""})
add(W, D, "proc", "flow1", {"mode": "date", "date": "2026-01-20"})
add(W, D, "proc", "flow2", {"mode": "date", "date": "2026-01-20"})
add(W, D, "recur", "na", {"na": "Y"})
add(W, D, "order", "na", {"na": "Y"})
add(W, D, "law", "lawA", {"duty_key": "DTY-00430", "date": "2026-08-31", "note": "8월 정수처리기준 준수 확인"}, {"ev": ["정수처리기준_월간보고_202608.pdf"]})
add(W, D, "law", "lawB", {"duty_key": "DTY-01595", "date": "2026-05-20", "note": "수도시설 관리 교육 이수"}, {"ev": ["수도시설_관리교육_수료증.pdf"]})

# ── 용인경전철(에버라인) 도시철도차량(공중교통수단 · 교통정책과) ─────────────────
L, D = "TR-01", "D10"
add(L, D, "staff", "people", {"rank": "과장", "date": "2026-01-02", "name": "오지훈", "dept": "안전총괄과", "note": "점검총괄"})
add(L, D, "staff", "people", {"rank": "주무관", "date": "2026-01-02", "name": "최우진", "dept": "교통정책과(경전철·주차장)", "note": "정담당"},
    {"ev": ["용인경전철 안전관리 인력현황표.xlsx"]})
add(L, D, "staff", "people", {"rank": "주무관", "date": "2026-01-02", "name": "정수빈", "dept": "교통정책과(경전철·주차장)", "note": "부담당"})
add(L, D, "staff", "org", {"date": "2026-01-02", "note": ""}, {"ev": ["용인경전철 안전관리 조직도 및 긴급상황 조치체계도.PDF"]})
add(L, D, "proc", "drill", {"name": "용인경전철(에버라인) 지진 대피훈련", "date": "2026-05-20", "text": "실행기반 훈련 · 참가 52명 · 목표 20분 / 실제 19분", "note": "DRL-0002"},
    {"ev": ["경전철_지진_대피훈련_결과서.pdf"]})
add(L, D, "law", "lawA", {"duty_key": "DTY-00603", "date": "2026-06-15", "note": "철도보호지구 행위 안전점검"})

COLS = ["rec_id", "scope", "dept_id", "year", "step", "block", "ord", "deleted", "status", "data", "files", "updated_at", "updated_by"]
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8-sig", newline="") as fp:
    w = csv.DictWriter(fp, fieldnames=COLS)
    w.writeheader()
    w.writerows(rows)
print(len(rows), "rows ->", os.path.abspath(OUT))
