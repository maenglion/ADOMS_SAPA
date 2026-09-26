# -*- coding: utf-8 -*-
"""
조직 재편 — 용인시 실제 조직(누리집 「부서 및 업무안내」 2026-09-24 조회)에 맞춰 부서·직원·시설 소관을 바로잡는다.
→ ops_v1.5_20260924(공통 판 · 3100·3200·3300·3400 모두 읽음) · us_v1.1_20260924(교육자료 버전 400 전용)

사용자 지시(2026-09-24): 중대재해 예방·재난안전관리·안전보건관리·재해 관련 시설물 관리 부서를 모두 조직도에 반영.
  겹치면 책임이 큰 한쪽에만 두고 유관 부서는 짧은 설명. 실무자 · 부서장 · 총괄 · 경영책임자 결재가 되게 인력 추가.
  데이터가 바뀌면 정합성이 깨지지 않게 꼼꼼히 검수.

원칙
  · 부서 번호(D01~D14)는 바꾸지 않는다 — 이름·실제 소속만 바로잡는다(조인이 끊기지 않게). 새 부서는 D15~.
  · 시설을 다른 부서로 옮기면, 그 시설에 걸린 기록(의무 배정·안전계획·신고·계약·재해·명령·경영책임자 활동·의무이행 기록)의 부서도 함께 옮긴다.
  · 앞 판은 덮어쓰지 않는다. 바뀐 표만 새 판에 쓴다(앱은 표마다 새 판부터 찾는다).
  · 옮긴 행은 전부 기록한다(_migration_log.csv) — 되돌릴 수 있게.
  · 사람 이름은 가상 인물. 실제 공무원 이름은 쓰지 않는다(누리집에서도 직위·업무만 읽었다).
"""
import csv, glob, io, json, os, sys, collections as C
csv.field_size_limit(10**9)

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
OPS_OUT = os.path.join(DEMO, "ops_v1.5_20260924", "seed")
US_OUT = os.path.join(DEMO, "us_v1.1_20260924", "seed")
LOG = os.path.join(DEMO, "ops_v1.5_20260924", "_migration_log.csv")

def latest(prefix, t):
    fs = sorted(glob.glob(os.path.join(DEMO, f"{prefix}*", "seed", f"{t}.csv")))
    return fs[-1] if fs else None
def read(path):
    with io.open(path, encoding="utf-8-sig") as f:
        r = csv.DictReader(f); return list(r.fieldnames), list(r)
def write(path, cols, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path): sys.exit("이미 있다 — 판을 덮어쓰지 않는다: " + path)
    with io.open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)

LOGROWS = []
def log(table, key, col, old, new, why):
    if str(old) != str(new): LOGROWS.append({"table": table, "key": key, "col": col, "old": old, "new": new, "why": why})

# ── 1. 부서 ───────────────────────────────────────────────────────────────
# (id, 이름, 역할, 상위(ADOMS 결재·관리 선), 실제 소속, 구분, 맡는 일(누리집 담당업무 요지), 유관 부서 설명, 누리집 확인)
ORG = [
 ("D01", "중대재해예방팀", "총괄", "", "제2부시장 › 안전정책관 › 중대재해예방팀", "팀",
  "중대산업재해·중대시민재해 예방 종합계획, 중대재해처벌법 의무사항 이행 확인 점검, 도급·용역·위탁 산업재해 예방 기준, 안전관리자·보건관리자(사업장 순회점검·위험성평가 지도)",
  "안전정책관 소속 — 안전정책팀(안전관리계획·재난관리평가) · 시민안전교육팀(시민 안전교육) · 민방위팀(충무계획)은 유관", "Y"),
 ("D02", "안전점검팀", "관리", "D01", "제2부시장 › 안전정책관 › 안전점검팀", "팀",
  "시설물안전법 대상 시설물 안전관리·지도, 재난취약시설·공공청사·급경사지 안전점검, 어린이놀이시설 안전지도, 제3종 시설물, 대형건설공사장 점검",
  "시설을 직접 관리하지는 않고 점검·지도한다 — 시설 소관은 각 사업부서", "Y"),
 ("D03", "도로구조물과", "현업", "D02", "제2부시장 › 건설국 › 도로구조물과", "과",
  "교량·터널 등 도로구조물(FMS 1·2·3종) 안전점검 용역·보수, 교량 내진성능평가, 도로터널 방재등급, 지하안전관리계획, 시설물통합정보관리시스템(FMS) 관리",
  "옹벽·절토사면은 도로 부속 구조물로 여기 둔다 — 도로건설과(도로 비탈면·제설·수해 대책)·안전점검팀(급경사지 점검)·구청 건설과·도로과(소규모 도로시설)는 유관", "Y"),
 ("D04", "상수도사업소", "현업", "D02", "상수도사업소 › 수도행정과 · 수도시설과 · 정수과", "사업소",
  "용인정수장·배수지·가압장·도송수관로 유지관리, 정수장 재난안전관리 종합계획, 수질·수처리(원료·제조물 — 수돗물), 전기·고압가스 안전관리자 선임",
  "중대재해처벌법·재난안전법 업무는 정수과 시설관리팀이 맡는다 — 수도시설과(급수·누수)는 유관", "Y"),
 ("D05", "하수도사업소", "현업", "D02", "하수도사업소 › 하수행정과 · 하수시설과 · 하수운영과 · 하수관로과", "사업소",
  "공공하수처리시설 운영·유지관리, 하수관로 관리, 밀폐공간·질식 위험 작업",
  "공공하수처리시설 17곳은 이번에 상수도사업소에서 여기로 바로잡았다", "Y"),
 ("D06", "푸른공원사업소", "현업", "D02", "푸른공원사업소 › 공원조성과 · 동부공원관리과 · 서부공원관리과", "사업소",
  "도시공원 유지관리, 어린이놀이시설 안전점검 위탁·정비, 물놀이장·수변공원 시설 관리, 도시공원 재해예방·복구",
  "안전점검팀(어린이놀이시설 안전지도)은 유관", "Y"),
 ("D07", "보육정책과", "현업", "D02", "(누리집 부서 목록에서 확인 못 함 — 확인 필요)", "과",
  "국공립어린이집 시설 안전·급식(원료·제조물 — 급식 식자재)", "누리집 조회(2026-09-24) 본청 목록에 없음 — 소속 국·이름 확인 필요", "N"),
 ("D08", "체육진흥과", "현업", "D02", "(누리집 부서 목록에서 확인 못 함 — 확인 필요)", "과",
  "공공체육시설(실내수영장 등) 안전관리", "누리집 조회 본청 목록에 없음 — 소속 국·이름 확인 필요", "N"),
 ("D09", "건축과", "현업", "D02", "제2부시장 › 주택국 › 건축과(건축관리팀 · 건축안전팀)", "과",
  "시설물안전법 제1·2종 시설물 관리(공동주택 외 건축물), 제3종 시설물 관리, 건축물 정기점검 대상 통보, 건축공사장 안전관리, 기계설비 유지관리자",
  "공공건축과(공공청사 건립·전기·기계·소방 공사 감독)·안전점검팀(공공청사 안전점검)은 유관 — 시설 운영부서(도서관·체육시설 등)가 관리주체일 수 있어 시설별 확인 필요", "Y"),
 ("D10", "교통정책과", "현업", "D02", "제2부시장 › 교통정책국 › 교통정책과(주차운영팀 · 주차시설팀)", "과",
  "공영주차장·기계식주차장, 교통안전시설, 어린이·노인·장애인 보호구역",
  "경전철은 이번에 도시철도과로 옮겼다 — 도시철도과는 유관", "Y"),
 ("D11", "보건소", "현업", "D02", "처인구보건소 › 보건정책과(감염병대응팀 · 보건행정팀)", "사업소",
  "감염병 재난·방역, 응급의료, 보건소 시설물(제3종) 지정관리, 보건소 종사자 중대산업재해 예방 관리",
  "기흥구보건소·수지구보건소(보건행정과)는 유관 — 같은 업무를 권역별로", "Y"),
 ("D12", "자원순환과", "현업", "D02", "(누리집 부서 목록에서 확인 못 함 — 확인 필요)", "과",
  "재활용 선별장·폐기물 처리시설 작업 안전", "누리집 조회 본청 목록에 없음 — 소속 국·이름 확인 필요", "N"),
 ("D13", "재난대응담당관", "현업", "D01", "제2부시장 › 재난대응담당관(재난대응팀 · 자연재난1팀 · 자연재난2팀 · 재난정보팀)", "담당관",
  "사회재난·자연재난 대응, 재난현장조치 행동매뉴얼, 다중이용시설 위기상황 매뉴얼, 재난관리자원 비축, 방재시설물 인수인계·우수유출 저감시설, 재해위험지구, 재난안전상황실",
  "하천(배수통문 등)은 이번에 생태하천과로 옮겼다 — 생태하천과는 유관(풍수해 대책·방재시설 인수는 여기) · 저수지(댐) 4곳은 한국농어촌공사 관리일 수 있어 관리주체 확인 필요", "Y"),
 ("D14", "농업기술센터", "현업", "D02", "농업기술센터 › 자원육성과 · 기술지원과 · 농촌테마과", "사업소",
  "학교급식 식재료(원료·제조물), 농업기계 안전", "", "Y"),
 ("D15", "도로건설과", "현업", "D02", "제2부시장 › 건설국 › 도로건설과(도로정비팀 등)", "과",
  "도로 설해·수해 대책, 도로 포장·비탈면 관리, 도로 안전 및 유지관리계획, 도로 제설",
  "도로구조물(교량·터널·옹벽·절토사면)의 시설물안전법 점검은 도로구조물과", "Y"),
 ("D16", "도시철도과", "현업", "D02", "제2부시장 › 교통정책국 › 도시철도과(경전철관리팀)", "과",
  "용인경전철 안전관리계획·안전대책·사고 관리, 차량·전력·신호·스크린도어 유지보수 관리, 역사 승강·소방시설 유지보수 감독, 재난대응 위기관리 매뉴얼",
  "경전철 운영은 위탁 운영사 — 시가 실질 관리(중대재해처벌법 공중교통수단 가목) · 교통정책과는 유관", "Y"),
 ("D17", "생태하천과", "현업", "D02", "제2부시장 › 건설국 › 생태하천과(하천행정팀 · 하천계획팀 · 하천시설팀)", "과",
  "지방하천·소하천 관리·정비, 하천시설(배수통문 등), 소규모 홍수위험지구 개량, 생태하천 복원",
  "재난대응담당관(풍수해 대책·방재시설 인수)·구청 건설과(소하천 현장)는 유관", "Y"),
 ("D18", "산림과", "현업", "D02", "제2부시장 › 농림축산국 › 산림과(산림정책팀 등)", "과",
  "산사태취약지역 관리·대응, 사방사업, 숲길·임도 조성·유지관리",
  "급경사지 점검은 안전점검팀 — 유관", "Y"),
 ("D19", "공공건축과", "현업", "D02", "제2부시장 › 주택국 › 공공건축과(공공청사팀 · 공공건축팀 · 건축설비팀)", "과",
  "공공청사·공공건축물 건립(도급 공사), 전기·통신·소방·기계 분야 공사 감독, 하자검사",
  "준공 뒤 시설 관리는 건축과·시설 운영부서 — 도급 공사 중 안전(중대재해처벌법 제5조)이 핵심", "Y"),
 ("D20", "대중교통과", "현업", "D02", "제2부시장 › 교통정책국 › 대중교통과(버스정책팀 등)", "과",
  "공영버스터미널·공영버스차고지 유지관리, 대중교통 운수업체 관리",
  "시외버스(공중교통수단)의 관리주체는 운송사업자 — 시는 터미널 시설과 준공영제 관리", "Y"),
 ("D21", "공동주택과", "현업", "D02", "제2부시장 › 주택국 › 공동주택과(주택관리팀 · 주택품질팀 등)", "과",
  "소규모 공동주택 안전점검, 공동주택 중대하자 안전진단, 공동주택 관리 지도",
  "공동주택은 중대재해처벌법 공중이용시설에서 빠지고(시행령 제3조) 관리주체는 입주자대표회의·관리사무소 — 시는 감독 · 이번에 건축과에서 공동주택 73곳을 옮겼다", "Y"),
 ("D22", "안전정책팀", "현업", "D01", "제2부시장 › 안전정책관 › 안전정책팀", "팀",
  "안전관리계획 수립·시행, 안전관리위원회, 재난관리평가, 재난안전예산, 안전문화, 재난안전분야 종사자 교육",
  "중대재해처벌법 이행은 중대재해예방팀 — 시민안전교육팀·민방위팀도 같은 안전정책관 소속 유관", "Y"),
 ("D99", "미지정", "미지정", "", "", "", "", "", ""),
]
NEW_DEPTS = [o[0] for o in ORG if o[0] >= "D15" and o[0] != "D99"]

# ── 2. 시설 소관 바로잡기 ─────────────────────────────────────────────────────
def asset_move(a):
    k, g = a["asset_kind"], a["asset_gbn"]
    if k == "공공하수처리시설" and a["dept_id"] == "D04": return "D05", "공공하수처리시설 — 하수도사업소 소관(상수도사업소로 잘못 들어가 있었다)"
    if g == "하천" and a["dept_id"] == "D13": return "D17", "하천시설(배수통문 등) — 생태하천과 소관(하천시설팀)"
    if k == "철도역시설" and a["dept_id"] == "D09": return "D16", "경전철 역사 — 도시철도과 소관(경전철관리팀)"
    if k == "공동주택" and a["dept_id"] == "D09": return "D21", "공동주택 — 공동주택과(감독). 관리주체는 민간 · 중대재해처벌법 공중이용시설 제외"
    return None, ""

# ── 3. 직원 ───────────────────────────────────────────────────────────────
POS_HEAD = {"D01": "중대재해예방팀장", "D02": "안전점검팀장", "D03": "도로구조물과장", "D04": "정수과장", "D05": "하수운영과장",
            "D06": "동부공원관리과장", "D07": "보육정책과장", "D08": "체육진흥과장", "D09": "건축과장", "D10": "교통정책과장",
            "D11": "보건정책과장", "D12": "자원순환과장", "D13": "재난대응담당관", "D14": "기술지원과장", "D15": "도로건설과장",
            "D16": "도시철도과장", "D17": "생태하천과장", "D18": "산림과장", "D19": "공공건축과장", "D20": "대중교통과장",
            "D21": "공동주택과장", "D22": "안전정책팀장"}
NAMES = ["김도윤", "이서현", "박지호", "최유진", "정하준", "강민서", "조은비", "윤성호", "장다은", "임재훈", "한지원", "오세진",
         "서준영", "신미경", "권태호", "황수진", "안정우", "송예린", "전현우", "홍승민", "유다인", "고민재", "문성희", "양지훈",
         "손유나", "배준혁", "백서영", "허동현", "노은서", "구본석", "민채원", "하승우", "진소영", "탁용준", "변지민", "염태경",
         "곽나연", "석진호", "우혜린", "추광민", "설지아", "편도현", "마영수", "제갈윤", "봉수아", "육현석", "남기범", "도슬기", "여민호", "성하늘", "왕보람"]

def main():
    for d in (OPS_OUT, US_OUT):
        if os.path.exists(d): sys.exit("이미 있다 — 판을 덮어쓰지 않는다: " + d)
    # 3-1. org_dept
    oc, orows = read(latest("ops_", "org_dept"))
    old = {r["dept_id"]: r for r in orows}
    cols = ["dept_id", "dept_name", "dept_role", "parent_dept_id", "org_path", "unit_kind", "duties", "related_note", "web_checked"]
    new_org = []
    for (i, n, role, par, path, kind, duties, rel, chk) in ORG:
        if i in old:
            for c, v in (("dept_name", n), ("dept_role", role), ("parent_dept_id", par)):
                log("org_dept", i, c, old[i].get(c, ""), v, "용인시 실제 조직에 맞춤")
        else:
            log("org_dept", i, "(새 부서)", "", n, "관련 부서 추가")
        new_org.append({"dept_id": i, "dept_name": n, "dept_role": role, "parent_dept_id": par, "org_path": path, "unit_kind": kind,
                        "duties": duties, "related_note": rel, "web_checked": chk})
    DEPTS = {r["dept_id"] for r in new_org}

    # 3-2. staff
    sc, srows = read(latest("ops_", "staff"))
    used = {r["display_name"].split()[0] for r in srows}
    pool = [n for n in NAMES if n not in used]
    scols = ["staff_id", "display_name", "dept_id", "duty_role", "position", "approval_level", "email", "phone", "note"]
    staff = []
    for r in srows:
        role = r["duty_role"]
        staff.append({**{k: r.get(k, "") for k in scols}, "position": "주무관", "approval_level": "1" if role in ("정담당", "부담당") else "1"})
    # 새 부서 실무자 2명씩
    for d in NEW_DEPTS:
        for j, role in ((1, "정담당"), (2, "부담당")):
            nm = pool.pop(0)
            staff.append({"staff_id": f"S{d}-{j}", "display_name": f"{nm} 주무관", "dept_id": d, "duty_role": role, "position": "주무관",
                          "approval_level": "1", "email": f"{d.lower()}.{'main' if j==1 else 'sub'}@demo.yongin.go.kr", "phone": "", "note": "가상 인물"})
            log("staff", f"S{d}-{j}", "(새 직원)", "", f"{nm} 주무관({role})", "새 부서 실무자")
    # 부서장 — 모든 부서(총괄 D01 은 팀장, 그 위 안전정책관은 총괄 확인자)
    for (i, n, role, *_ ) in ORG:
        if i == "D99": continue
        nm = pool.pop(0)
        pos = POS_HEAD[i]
        staff.append({"staff_id": f"H{i[1:]}", "display_name": f"{nm} {pos}", "dept_id": i, "duty_role": "부서장", "position": pos,
                      "approval_level": "2", "email": f"{i.lower()}.head@demo.yongin.go.kr", "phone": "", "note": "가상 인물 · 결재선 부서장"})
        log("staff", f"H{i[1:]}", "(새 직원)", "", f"{nm} {pos}", "결재선 부서장")
    # 총괄 확인(안전정책관) · 경영책임자
    nm = pool.pop(0)
    staff.append({"staff_id": "G01", "display_name": f"{nm} 안전정책관", "dept_id": "D01", "duty_role": "총괄", "position": "안전정책관",
                  "approval_level": "3", "email": "safety.director@demo.yongin.go.kr", "phone": "", "note": "가상 인물 · 결재선 총괄 확인(국장급)"})
    staff.append({"staff_id": "CEO-1", "display_name": "시장", "dept_id": "", "duty_role": "경영책임자", "position": "시장",
                  "approval_level": "4", "email": "", "phone": "", "note": "경영책임자 — 실명 쓰지 않음"})
    log("staff", "G01", "(새 직원)", "", f"{nm} 안전정책관", "결재선 총괄 확인")
    log("staff", "CEO-1", "(새 직원)", "", "시장", "경영책임자(직원 명부에 없어 기록이 다른 이름으로 남던 것 바로잡음)")
    # 기존 D01 정담당 = 총괄 실무(결재선 3단계 앞 검토) — 표시만
    STAFF = {r["staff_id"] for r in staff}
    main_of = {r["dept_id"]: r["staff_id"] for r in staff if r["duty_role"] == "정담당"}
    sub_of = {r["dept_id"]: r["staff_id"] for r in staff if r["duty_role"] == "부담당"}

    # 3-3. 시설
    ac, arows = read(latest("ops_", "asset"))
    MOVE = {}
    for a in arows:
        nd, why = asset_move(a)
        if nd:
            log("asset", a["asset_id"], "dept_id", a["dept_id"], nd, why)
            MOVE[a["asset_id"]] = (a["dept_id"], nd); a["dept_id"] = nd
    # 경전철 운영(공중교통수단)으로 옮기는 부서 기록 판단
    # 경전철 공중교통수단 번호(교육자료 버전의 usb1_transport — 이름에 경전철이 든 것)
    RAIL_IDS = set()
    tp = latest("us_", "usb1_transport")
    if tp:
        for t in read(tp)[1]:
            if "경전철" in t.get("tr_name", "") or "에버라인" in t.get("tr_name", ""): RAIL_IDS.add(t["tr_id"])
    def is_rail(*vals): return any(("경전철" in str(v) or "에버라인" in str(v) or str(v) in RAIL_IDS) for v in vals)

    out_ops = {"org_dept": (cols, new_org), "staff": (scols, staff), "asset": (ac, arows)}

    # 3-4. 의무 배정
    dc, drows = read(latest("ops_", "duty_assignment"))
    for r in drows:
        nd = None; why = ""
        if r["asset_id"] in MOVE and r["dept_id"] == MOVE[r["asset_id"]][0]:
            nd, why = MOVE[r["asset_id"]][1], "시설 소관 이동을 따라"
        elif not r["asset_id"] and r["dept_id"] == "D10" and r["target_code"] == "TG14":
            nd, why = "D16", "경전철(공중교통수단) — 도시철도과"
        if nd:
            log("duty_assignment", r["assign_id"], "dept_id", r["dept_id"], nd, why)
            log("duty_assignment", r["assign_id"], "owner_staff_id", r["owner_staff_id"], main_of[nd], why)
            log("duty_assignment", r["assign_id"], "deputy_staff_id", r["deputy_staff_id"], sub_of[nd], why)
            r["dept_id"], r["owner_staff_id"], r["deputy_staff_id"] = nd, main_of[nd], sub_of[nd]
    # 관리주체가 아닌 시설(시설 판정 「제외」)에 「해당」으로 붙은 배정 — 판정이 서로 어긋난다.
    # 자동으로 비해당 처리하지 않는다(원칙 4) — 「확인필요」로 표시해 담당이 의무 상세에서 확정하게 한다.
    excl = {a["asset_id"] for a in arows if a.get("sapa_l2_result") == "제외"}
    for r in drows:
        if r["asset_id"] in excl and r["applicability"] == "해당":
            log("duty_assignment", r["assign_id"], "applicability", "해당", "확인필요", "시설 판정 「제외」(관리주체 아님)와 어긋남 — 담당 확인 필요")
            r["applicability"] = "확인필요"
            note = "시설 판정 「제외」(관리주체 아님) — 해당 여부 확인 필요(09-24 정합성 검수)"
            log("duty_assignment", r["assign_id"], "applicability_note", r.get("applicability_note", ""), note, "검수 표시")
            r["applicability_note"] = note
    out_ops["duty_assignment"] = (dc, drows)

    # 3-5. 시설·경전철에 딸린 기록
    def follow(t, keycol, textcols=(), staffcol=None, prefix="ops_", out=None):
        p = latest(prefix, t)
        if not p: return
        c, rows = read(p); n = 0
        for r in rows:
            nd = None; why = ""
            aid = r.get("asset_id") or r.get("scope") or ""
            if aid in MOVE and r.get("dept_id") == MOVE[aid][0]:
                nd, why = MOVE[aid][1], "시설 소관 이동을 따라"
            elif r.get("dept_id") == "D10" and is_rail(*[r.get(x, "") for x in textcols], aid):
                nd, why = "D16", "경전철 기록 — 도시철도과"
            if nd:
                log(t, r[keycol], "dept_id", r["dept_id"], nd, why); r["dept_id"] = nd; n += 1
                if staffcol and r.get(staffcol):
                    log(t, r[keycol], staffcol, r[staffcol], main_of[nd], why); r[staffcol] = main_of[nd]
        if n: (out if out is not None else out_ops)[t] = (c, rows)
        return n
    follow("civil_safety_plan", "plan_id", ("facility_name",))
    follow("hazard_report", "hz_id", ("asset_name",))
    follow("drill_plan", "drill_id", ("target_name",))
    follow("contract", "contract_id", ("contract_name",))
    follow("incident", "incident_id", ("summary",))
    follow("order_received", "order_id", ("content",), staffcol="owner_staff_id")
    follow("ceo_activity", "activity_id", ("title",))
    # 예시 기록이 내용과 무관한 학교 건물(교육청 소관 · 판정 「제외」)에 연결된 것 — 시설 연결만 푼다(기록은 그대로)
    school = {a["asset_id"] for a in arows if a.get("sapa_l2_result") == "제외" and "학교" in a.get("asset_name", "")}
    for t, keycol in (("incident", "incident_id"), ("order_received", "order_id"), ("ceo_activity", "activity_id")):
        src = out_ops[t] if t in out_ops else read(latest("ops_", t))
        c, rows = src; n = 0
        for r in rows:
            if r.get("asset_id") in school:
                log(t, r[keycol], "asset_id", r["asset_id"], "", "내용과 무관한 학교 건물(교육청 소관)에 연결돼 있었다 — 시설 연결 해제"); r["asset_id"] = ""; n += 1
        if n: out_ops[t] = (c, rows)
    # 예산 — 경전철만 담은 줄만 옮긴다(주차장·기계식주차장이 섞인 줄은 교통정책과에 둔다)
    bc, brows = read(latest("ops_", "safety_budget")); nb = 0
    for r in brows:
        note = r.get("note", "")
        rail = any(w in note for w in ("경전철", "역사", "승강장", "비상대응 훈련"))
        if r["dept_id"] == "D10" and rail and "주차" not in note:
            log("safety_budget", r["budget_id"], "dept_id", r["dept_id"], "D16", "경전철 예산 — 도시철도과"); r["dept_id"] = "D16"; nb += 1
    if nb: out_ops["safety_budget"] = (bc, brows)
    # 교육 과정 적용 부서
    tc, trows = read(latest("ops_", "training_course")); nt = 0
    for r in trows:
        if "D10" in r.get("applies_depts", "") and is_rail(r.get("course_name", ""), r.get("note", "")):
            nv = r["applies_depts"].replace("D10", "D16")
            log("training_course", r["course_id"], "applies_depts", r["applies_depts"], nv, "철도안전교육 — 도시철도과"); r["applies_depts"] = nv; nt += 1
    if nt: out_ops["training_course"] = (tc, trows)

    # 3-6. 교육자료 버전(400) 표
    out_us = {}
    follow("usd_record", "rec_id", (), prefix="us_", out=out_us)
    p = latest("us_", "usb1_transport")
    if p:
        c, rows = read(p); n = 0
        for r in rows:
            if r.get("dept_id") == "D10": log("usb1_transport", r["tr_id"], "dept_id", "D10", "D16", "경전철 — 도시철도과"); r["dept_id"] = "D16"; n += 1
        if n: out_us["usb1_transport"] = (c, rows)

    # 4. 쓰기
    for t, (c, rows) in out_ops.items(): write(os.path.join(OPS_OUT, f"{t}.csv"), c, rows)
    for t, (c, rows) in out_us.items(): write(os.path.join(US_OUT, f"{t}.csv"), c, rows)
    with io.open(LOG, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["table", "key", "col", "old", "new", "why"]); w.writeheader(); w.writerows(LOGROWS)
    cnt = C.Counter(r["table"] for r in LOGROWS)
    print("ops_v1.5 표:", sorted(out_ops), "\nus_v1.1 표:", sorted(out_us))
    print("바꾼 칸:", dict(cnt), "합", len(LOGROWS))
    print("시설 이동:", C.Counter(v for v in MOVE.values()))

if __name__ == "__main__":
    main()
