# -*- coding: utf-8 -*-
"""
도급·용역·위탁 — ops_v0.5 (2026-09-21)

v0.4 를 읽어 칸과 표를 더한다. v0.4 는 한 글자도 고치지 않는다(발행된 판).

무엇을 더하나 (참고 명세 빠짐목록 B장 #12~#16)
  · contract.csv          71건 전부 — 계약 기본정보 19필드가 되도록 새 칸을 채운다
  · hazard_code.csv       유해·위험요인 18항목 코드 마스터
  · contract_hazard_map.csv  contract_hazard(자유 문구) → 18항목 코드 매핑(문구·장소 규칙, 규칙 밖은 넣지 않는다)
  · contract_mgmt_item.csv   관리의무 이행정보 고정 4항목(근거 조문 unit_id·원문 포함)
  · contract_compliance.csv  계약 × 4항목 준수여부(이행·보완필요·미이행 / 건설공사가 아니면 ③ 해당없음) + 증빙 이름

지키는 것
  · 사업자등록번호는 만들지 않는다(지어내면 실존 번호와 겹칠 수 있다) → 「수급인 확인 서류 제출됨/미제출」
  · 수탁 담당자는 사람 이름 없이 직책만(현장대리인·책임기술자 …)
  · 수탁 연락처도 번호를 지어내지 않는다(실존 휴대전화와 겹칠 수 있다) → 「등록됨/미등록」
  · 담당자 연락처는 부서 대표번호 형식(031-324-XXXX)의 예시값
  · 첨부파일은 「목록」만 — 실제 파일은 없다
  · 준수여부는 이미 있는 칸에서 이끌어 낸다(평가 실시 → ①, 관리비 → ②, 조항·걸린 의무 상태 → ④).
    이끌어 낼 근거가 없는 ②(용역·위탁·물품)·③ 만 정해진 난수로 나눈다.

근거 조문 (정본 unit_20260901_v2.1.csv 로 확인)
  시행령 제4조제9호가목 UNIT-0004835 「도급, 용역, 위탁 등을 받는 자의 산업재해 예방을 위한 조치 능력과 기술에 관한 평가기준ㆍ절차」
  시행령 제4조제9호나목 UNIT-0004836 「… 안전ㆍ보건을 위한 관리비용에 관한 기준」
  시행령 제4조제9호다목 UNIT-0004834 「건설업 및 조선업의 경우 … 공사기간 또는 건조기간에 관한 기준」
  법 제5조             UNIT-0004722 「도급, 용역, 위탁 등 관계에서의 안전 및 보건 확보의무」
"""
import csv, io, os, random, datetime as dt

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V1 = os.path.join(BASE, "ops_v0.1_20260920", "seed")
V4 = os.path.join(BASE, "ops_v0.4_20260921", "seed")
OUT = os.path.join(BASE, "ops_v0.5_20260921", "seed")
os.makedirs(OUT, exist_ok=True)
random.seed(20260921 + 5)
EX = "예시 데이터(시연용)"


def rd(d, n):
    with io.open(os.path.join(d, n + ".csv"), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def wr(n, rows, cols):
    p = os.path.join(OUT, n + ".csv")
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in cols})
    print("  %-26s %6d행" % (n + ".csv", len(rows)))


contracts = rd(V4, "contract")
hazards = rd(V4, "contract_hazard")
cduties = rd(V4, "contract_duty")
assets = {a["asset_id"]: a for a in rd(V1, "asset")}
assert len(contracts) == 71, len(contracts)

# ── 1. 계약 기본정보 새 칸 ───────────────────────────────────────
DEPT_PLACE = {
    "D01": "시청사 사무 공간", "D02": "시청사 사무 공간", "D03": "관내 도로·교량·터널 구간",
    "D04": "정수장·가압장·배수지 및 상수관로 구간", "D05": "하수처리장·하수관로 일원",
    "D06": "관내 도시공원·녹지", "D07": "관내 국공립어린이집", "D08": "시민체육관·공공체육시설",
    "D09": "시청사·공공건축물", "D10": "공영주차장·경전철 역사", "D11": "보건소·방역 대상 지역",
    "D12": "관내 수거 권역·선별시설", "D13": "급경사지·소하천 등 재난취약지역", "D14": "농업기술센터",
}
# 이름 속 낱말이 더 구체적이면 그것을 쓴다
NAME_PLACE = [
    ("처인구", "처인구 관내 시도 구간"), ("기흥·수지구", "기흥구·수지구 관내 시도 구간"),
    ("정수장", "정수장"), ("가압장", "가압장"), ("배수지", "배수지"),
    ("하수처리", "공공하수처리시설"), ("하수관로", "하수관로 구간(맨홀 포함)"),
    ("밀폐공간", "맨홀·저류조 등 밀폐공간"), ("어린이놀이", "관내 어린이놀이시설"),
    ("수영장", "실내수영장 기계실"), ("승강기", "공공청사 승강기"), ("기계식주차장", "기계식주차장"),
    ("경전철", "경전철 역사"), ("급경사지", "급경사지 붕괴위험지역"), ("소하천", "소하천 정비 구간"),
    ("가로수", "관내 가로수 식재 구간"), ("제설", "관내 제설 담당 노선"),
]

MAIN_TASK = [
    ("포장보수", "파손 포장 절삭·덧씌우기 및 포트홀 보수"),
    ("받침·신축이음", "교량 받침 교체 및 신축이음장치 보수"),
    ("터널 조명", "터널 조명등 교체 및 제트팬 개량"),
    ("정밀안전점검", "정밀안전점검 실시 및 결과 보고"),
    ("정밀안전진단", "정밀안전진단(외관조사·재료시험·안전성 평가)"),
    ("제설", "제설제 살포·제설장비 운영"),
    ("가로등", "가로등·보안등 교체 및 배선 정비"),
    ("상수관로 교체", "노후 상수관 굴착·교체 및 도로 복구"),
    ("약품", "정수 약품 운반·저장·투입"),
    ("수질검사", "수질 시료 채취 및 검사 대행"),
    ("펌프", "펌프·전동기 교체 및 시운전"),
    ("수배전반", "수배전반 교체 및 전기설비 개선"),
    ("준설", "관로 준설·세정 및 퇴적물 처리"),
    ("정밀조사", "관로 CCTV 조사 및 결함 평가"),
    ("우수관로", "우수관로 신설·개량 및 도로 복구"),
    ("밀폐공간", "밀폐공간 작업 전 가스 측정·감시인 배치 등 안전관리"),
    ("경비", "청사 청소·경비 및 시설 순찰"),
    ("냉난방", "냉난방·공조설비 점검 및 정비"),
    ("승강기", "승강기 정기 점검·부품 교체"),
    ("방수", "옥상 방수층 교체 및 외벽 보수"),
    ("소방·전기", "소방·전기설비 교체 및 성능 개선"),
    ("통합관제", "관제 시스템 운영 지원 및 장애 대응"),
    ("전지", "수목 전지·제초·병해충 관리"),
    ("시설물 유지보수", "공원 시설물 보수·교체"),
    ("시설 개선공사", "공원 시설 철거·신설 공사"),
    ("방제", "병해충 약제 살포"),
    ("예·경보", "재난 예·경보시설 점검·수리"),
    ("급경사지 붕괴", "급경사지 보강(옹벽·낙석방지시설) 공사"),
    ("실태조사", "급경사지 현장 조사 및 위험도 평가"),
    ("구호물자", "재난관리자원 구매·납품"),
    ("통신망", "통신망 운영 지원 및 단말 관리"),
    ("소하천", "소하천 호안·배수시설 정비 공사"),
    ("어린이집 위탁", "어린이집 운영(보육·급식·시설 안전 관리)"),
    ("식자재", "급식 식자재 납품"),
    ("실내공기질", "실내공기질 측정 및 결과 보고"),
    ("방역", "방역 소독 및 약제 관리"),
    ("의료폐기물", "의료폐기물 수집·운반·처리"),
    ("체육관 운영", "체육관 운영 및 시설 안전 관리"),
    ("기계실", "기계실 설비 교체 및 배관 공사"),
    ("주차장 관리", "주차장 운영·요금 징수·시설 관리"),
    ("정기검사", "기계식주차장 정기검사 대행"),
    ("승강설비", "역사 승강기·에스컬레이터 유지관리"),
    ("위험성평가", "위험성평가 절차 수립 지원 및 현장 평가"),
    ("교육", "중대재해 예방 교육 실시"),
    ("시스템 구축", "안전보건관리체계 시스템 설계·구축"),
    ("작업환경측정", "작업환경측정 및 특수건강진단 실시"),
    ("수준평가", "도급사업 수급인 안전보건 수준평가 대행"),
    ("수집·운반", "생활폐기물 수집·운반(차량 운행 포함)"),
    ("선별", "재활용품 선별·압축·반출"),
    ("안전관리 자문", "공공건설공사 안전관리 자문"),
    ("품질시험", "건설 자재 품질시험 대행"),
    ("전기설비 개선", "전기설비 교체 및 성능 개선"),
    ("검침", "상수도 검침 및 고객 응대"),
    ("보호구", "안전보호구·소방용품 구매·납품"),
    ("화장실", "공원 화장실 청소 및 위생 관리"),
    ("표지", "도로표지·교통안전시설 자재 납품"),
    ("CCTV", "CCTV·전광판 점검 및 장애 대응"),
    ("기계설비 정비", "처리장 기계설비 정비·교체"),
    # 두루 걸리는 낱말은 맨 뒤에 둔다(앞의 구체적인 것이 먼저 잡히게)
    ("안전점검", "안전점검 실시 및 결과 보고"),
    ("운영 위탁", "시설 운영·유지관리 전반 대행"),
    ("청소", "청소 및 위생 관리"),
    ("유지관리", "시설 정기 점검·보수 및 고장 대응"),
]

REP_ROLE = {"공사": "현장대리인", "위탁": "운영책임자", "물품": "납품 담당"}
ATTACH = {
    "공사": ["계약서", "설계서·내역서", "안전관리계획서", "산업안전보건관리비 사용계획서"],
    "용역": ["계약서", "과업내용서", "안전보건 작업계획서"],
    "위탁": ["위탁협약서", "운영계획서", "안전보건관리계획서"],
    "물품": ["계약서", "규격서"],
}
SAFETY_DOCS = {"안전관리계획서", "산업안전보건관리비 사용계획서", "안전보건 작업계획서", "안전보건관리계획서"}


def pick(rules, name, default):
    for k, v in rules:
        if k in name:
            return v
    return default


for c in contracts:
    kind, trade, name = c["contract_type"], c["trade"], c["contract_name"]
    start = dt.date.fromisoformat(c["start_date"])
    amount = int(c["amount"])
    dno = int(c["dept_id"][1:])
    c["manager_phone"] = "031-324-%04d" % (2000 + dno * 10)
    c["work_start_date"] = (start + dt.timedelta(days=random.randint(3, 14))).isoformat() if kind == "공사" else c["start_date"]
    c["main_task"] = pick(MAIN_TASK, name, "")
    if not c["main_task"]:
        print("  ! 주요 수행업무 규칙 밖:", name)
        c["main_task"] = {"공사": "시공 및 현장 안전관리", "물품": "물품 납품 및 하역"}.get(kind, "과업 수행 및 결과 보고")
    a = assets.get(c["asset_id"])
    c["work_place"] = a["asset_name"] if a else pick(NAME_PLACE, name, DEPT_PLACE.get(c["dept_id"], "관내 일원"))
    if kind == "용역":
        c["vendor_rep_role"] = "책임기술자" if trade in ("안전", "정보") else "현장책임자"
    else:
        c["vendor_rep_role"] = REP_ROLE[kind]
    if kind == "물품":
        c["vendor_safety_role"] = "하역 안전 담당(납품 담당 겸직)"
    elif kind == "공사" and amount >= 2000000000:
        c["vendor_safety_role"] = "안전관리자"
    else:
        c["vendor_safety_role"] = "안전담당(%s 겸직)" % c["vendor_rep_role"]
    c["vendor_contact_on_file"] = "Y" if random.random() < 0.93 else "N"
    c["vendor_doc_status"] = "제출됨" if random.random() < (0.7 if kind == "물품" else 0.92) else "미제출"
    w = int(c["worker_cnt"] or 0)
    c["regular_workers"] = max(w + random.randint(2, 12), int(w * random.uniform(1.4, 3.2)))
    docs = ATTACH[kind]
    if "없음" in c["safety_clause"]:
        docs = [d for d in docs if d not in SAFETY_DOCS]
    c["attachments"] = " · ".join(docs)

# ── 2. 유해·위험요인 18항목 ─────────────────────────────────────
HZ = ["추락", "낙하·비래", "협착", "전도", "감전", "화재·폭발", "질식", "붕괴", "중장비 충돌",
      "화학물질 노출", "고온·저온", "소음·진동", "분진", "밀폐공간", "차량", "절단·베임", "근골격계", "기타"]
assert len(HZ) == 18
code = {n: "HZ%02d" % i for i, n in enumerate(HZ, 1)}
hz_rows = [{"hazard_code": code[n], "hazard_name": n, "sort_no": i, "note": "도급 작업 유해·위험요인 체크 항목"}
           for i, n in enumerate(HZ, 1)]

# 문구 속 낱말 → 코드. 순서대로 모두 본다(한 문구가 둘 이상에 걸릴 수 있다).
FACTOR_RULE = [
    ("추락", "추락"), ("낙하", "낙하·비래"), ("협착", "협착"), ("전도", "전도"), ("미끄러짐", "전도"),
    ("감전", "감전"), ("질식", "질식"), ("붕괴", "붕괴"), ("유해가스", "화학물질 노출"),
    ("화학물질", "화학물질 노출"),
]
PLACE_RULE = [("밀폐공간", "밀폐공간"), ("중장비", "중장비 충돌")]


def factor_codes(h):
    out = []
    f, p = h["hazard_factor"], h["hazard_place"]
    for k, n in FACTOR_RULE:
        if k in f and (n, "위험요인 문구") not in out:
            out.append((n, "위험요인 문구"))
    # 「충돌」은 장소가 가른다 — 중장비 반입로면 중장비, 그 밖은 차량
    if "충돌" in f:
        out.append(("중장비 충돌" if "중장비" in p else "차량", "위험요인 문구 + 작업 장소"))
    for k, n in PLACE_RULE:
        if k in p and not any(x[0] == n for x in out):
            out.append((n, "작업 장소"))
    return out


hmap, unmapped = [], []
for h in hazards:
    cs = factor_codes(h)
    if not cs:
        unmapped.append(h)
    for n, basis in cs:
        hmap.append({"hazard_id": h["hazard_id"], "contract_id": h["contract_id"], "hazard_code": code[n],
                     "map_basis": basis, "source_text": "%s / %s" % (h["hazard_place"], h["hazard_factor"])})
assert not unmapped, unmapped

# ── 3. 관리의무 이행정보 고정 4항목 ─────────────────────────────
ITEMS = [
    {"item_no": 1, "item_code": "E4-9-GA", "item_name": "수급인의 안전·보건 확보 능력·기술 평가 기준·절차",
     "basis": "중대재해 처벌 등에 관한 법률 시행령 제4조제9호가목", "basis_unit_id": "UNIT-0004835",
     "basis_text": "도급, 용역, 위탁 등을 받는 자의 산업재해 예방을 위한 조치 능력과 기술에 관한 평가기준ㆍ절차",
     "applies_to": "전체", "evidence_hint": "수급인 안전보건 수준 평가표 · 평가 기준·절차 문서"},
    {"item_no": 2, "item_code": "E4-9-NA", "item_name": "안전·보건 관리비용 기준",
     "basis": "중대재해 처벌 등에 관한 법률 시행령 제4조제9호나목", "basis_unit_id": "UNIT-0004836",
     "basis_text": "도급, 용역, 위탁 등을 받는 자의 안전ㆍ보건을 위한 관리비용에 관한 기준",
     "applies_to": "전체", "evidence_hint": "관리비용 산정 기준 · 산업안전보건관리비 계상·집행 내역"},
    {"item_no": 3, "item_code": "E4-9-DA", "item_name": "공사기간·건조기간 기준",
     "basis": "중대재해 처벌 등에 관한 법률 시행령 제4조제9호다목", "basis_unit_id": "UNIT-0004834",
     "basis_text": "건설업 및 조선업의 경우 도급, 용역, 위탁 등을 받는 자의 안전ㆍ보건을 위한 공사기간 또는 건조기간에 관한 기준",
     "applies_to": "공사", "evidence_hint": "적정 공사기간 산정 검토서"},
    {"item_no": 4, "item_code": "L5", "item_name": "도급인의 안전·보건 확보 조치",
     "basis": "중대재해 처벌 등에 관한 법률 제5조", "basis_unit_id": "UNIT-0004722",
     "basis_text": "제3자에게 도급, 용역, 위탁 등을 행한 경우에는 제3자의 종사자에게 중대산업재해가 발생하지 아니하도록 제4조의 조치를 하여야 한다",
     "applies_to": "전체", "evidence_hint": "계약서 안전보건 조항 · 협의체 회의록 · 합동점검 기록"},
]

cd_by = {}
for d in cduties:
    cd_by.setdefault(d["contract_id"], []).append(d)


def split3(p_ok, p_mid):
    r = random.random()
    return "이행" if r < p_ok else "보완필요" if r < p_ok + p_mid else "미이행"


comp = []
for c in contracts:
    cid, kind = c["contract_id"], c["contract_type"]
    start = dt.date.fromisoformat(c["start_date"])
    n = cid.split("-")[1]
    # ① 평가 — 이미 있는 칸(evaluation_done·eval_score)에서
    if c["evaluation_done"] == "Y":
        s1 = "이행" if int(c["eval_score"] or 0) >= 75 else "보완필요"
        e1 = "수급인 안전보건 수준 평가표(%s).pdf" % c["eval_date"]
        n1 = "" if s1 == "이행" else "평가 점수 %s점 — 기준(75점) 미달인데 보완계획 없이 선정" % c["eval_score"]
    else:
        s1, e1, n1 = "미이행", "", "발주 전 수급인 평가를 하지 않음"
    # ② 관리비용 — 공사는 산업안전보건관리비 칸이 있다
    if kind == "공사" and c["safety_cost"]:
        s2, n2 = "이행", "산업안전보건관리비 계상(계약금액의 %.1f%%)" % (int(c["safety_cost"]) / int(c["amount"]) * 100)
        e2 = "산업안전보건관리비 계상 내역서.xlsx"
    else:
        s2 = split3(0.4, 0.3) if kind == "물품" else split3(0.7, 0.2)
        e2 = "" if s2 == "미이행" else "안전보건 관리비용 산정 기준(과업내용서 반영분).pdf"
        n2 = {"이행": "", "보완필요": "과업내용서에 관리비용 항목은 있으나 산정 기준이 없음",
              "미이행": "관리비용 기준 없이 발주"}[s2]
    # ③ 공사기간 — 건설공사만
    if kind == "공사":
        s3 = split3(0.75, 0.25)
        e3 = "적정 공사기간 산정 검토서.pdf"
        n3 = "" if s3 == "이행" else "우기·동절기 작업중지 일수를 반영하지 않음"
    else:
        s3, e3, n3 = "해당없음", "", "건설공사가 아님(시행령 제4조제9호다목은 건설업·조선업)"
    # ④ 법 제5조 — 계약서 조항과 걸린 의무 상태에서
    ds = cd_by.get(cid, [])
    if "없음" in c["safety_clause"]:
        s4, e4, n4 = "미이행", "", "계약서에 안전보건 확보 조항이 없음"
    elif any(d["status"] == "조치필요" for d in ds):
        s4, e4 = "보완필요", "안전보건 협의체 회의록.pdf"
        n4 = "걸린 의무 중 조치필요 %d건" % sum(1 for d in ds if d["status"] == "조치필요")
    else:
        s4, e4, n4 = "이행", "안전보건 협의체 회의록·합동점검 기록.pdf", ""
    for no, (s, e, note) in enumerate([(s1, e1, n1), (s2, e2, n2), (s3, e3, n3), (s4, e4, n4)], 1):
        comp.append({
            "cc_id": "CCP-%s-%d" % (n, no), "contract_id": cid, "item_no": no,
            "item_code": ITEMS[no - 1]["item_code"], "status": s, "evidence_name": e,
            "checked_at": "" if s in ("미이행", "해당없음") else (start + dt.timedelta(days=random.randint(10, 60))).isoformat(),
            "finding": note, "note": EX,
        })

# ── 쓰기 ───────────────────────────────────────────────────────
print("ops_v0.5 — 도급·용역·위탁")
V4_COLS = list(rd(V4, "contract")[0].keys())
NEW_COLS = ["manager_phone", "work_start_date", "main_task", "work_place", "vendor_rep_role",
            "vendor_safety_role", "vendor_contact_on_file", "vendor_doc_status", "regular_workers", "attachments"]
cols = [x for x in V4_COLS if x != "note"] + NEW_COLS + ["note"]
wr("contract", contracts, cols)
wr("hazard_code", hz_rows, ["hazard_code", "hazard_name", "sort_no", "note"])
wr("contract_hazard_map", hmap, ["hazard_id", "contract_id", "hazard_code", "map_basis", "source_text"])
wr("contract_mgmt_item", ITEMS, ["item_no", "item_code", "item_name", "basis", "basis_unit_id", "basis_text",
                                  "applies_to", "evidence_hint"])
wr("contract_compliance", comp, ["cc_id", "contract_id", "item_no", "item_code", "status", "evidence_name",
                                  "checked_at", "finding", "note"])

# 빈칸 검사 — 71건 모두 새 칸이 차 있어야 한다
for k in NEW_COLS:
    empty = [c["contract_id"] for c in contracts if str(c.get(k, "")) == ""]
    assert not empty, (k, empty[:5])

from collections import Counter
print("\n검산")
print("  새 칸 %d개 — 71건 모두 채움" % len(NEW_COLS))
print("  위험요인 %d건 → 매핑 %d행 · 쓰인 코드 %d/18" % (len(hazards), len(hmap), len({m['hazard_code'] for m in hmap})))
for no in range(1, 5):
    print("  항목 %d %s" % (no, dict(Counter(r["status"] for r in comp if r["item_no"] == no))))
print("  수급인 확인 서류 %s" % dict(Counter(c["vendor_doc_status"] for c in contracts)))
print("판 폴더: %s" % OUT)
