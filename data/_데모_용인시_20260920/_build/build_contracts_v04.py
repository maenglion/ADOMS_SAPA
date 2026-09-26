# -*- coding: utf-8 -*-
"""
도급·용역·위탁 계약 70건 생성 — ops_v0.4 (2026-09-21)

왜 만드는가
  사용자 판단(09-21): 「공무원들이 감동 받을 거 같은 건 도급/용역/위탁 계약을 50~80개쯤
  채워놓고 그걸로 시연할 경우」. 도급은 공무원이 매일 하는 일이고, 중처법 제5조가 바로 그 자리다.

업체 이름을 어떻게 지었나 — ★ 중요
  실존 업체 이름을 「조금 변형」하지 **않았다**. 변형해도 알아볼 수 있고, 그 회사가 안전사고를
  냈다거나 안전조항 없이 일했다는 **가짜 기록**이 되기 때문이다.
  대신 **용인 지명 + 업종어**로 새로 지었다(처인·기흥·수지·양지·모현·포곡·남사·이동·원삼·백암·
  구성·신갈·동백·죽전·보정·상현·성복·역북·마북·삼가 × 건설·산업·환경·안전·테크·조경·전기 …).
  지역 업체 작명법 그대로라 시연에서는 똑같이 실감나고, 특정 회사를 가리키지 않는다.
  모든 행의 note 에 「예시 데이터(시연용)」를 남긴다.

무엇이 들어 있나
  · contract 70건 — 공사·용역·위탁·물품 / 부서 소관에 맞게 / 금액·기간·안전조항·수급인 평가
  · 새 칸 — 산업안전보건관리비 · 투입 인원 · 재하도급 · 평가 점수·일자 · 계약 방식
  · contract_hazard 계약마다 2~4건 · contract_duty 계약마다 2~5건
"""
import csv, io, os, random, datetime as dt

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V1 = os.path.join(BASE, "ops_v0.1_20260920", "seed")
V3 = os.path.join(BASE, "ops_v0.3_20260921", "seed")
OUT = os.path.join(BASE, "ops_v0.4_20260921", "seed")
os.makedirs(OUT, exist_ok=True)
random.seed(20260921)
EX = "예시 데이터(시연용)"
TODAY = dt.date(2026, 9, 21)


def rd(d, n):
    with io.open(os.path.join(d, n + ".csv"), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def wr(n, rows, cols):
    with io.open(os.path.join(OUT, n + ".csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in cols})
    print("  %-22s %6d행" % (n + ".csv", len(rows)))


duty = rd(V3, "duty_class")
asset = rd(V1, "asset")
staff = rd(V1, "staff")
staff_by_dept = {}
for s in staff:
    staff_by_dept.setdefault(s["dept_id"], []).append(s["staff_id"])

asset_by_kind = {}
for a in asset:
    asset_by_kind.setdefault(a["asset_gbn"], []).append(a)

# ── 업체 이름 ────────────────────────────────────────────────────
PLACE = ["처인", "기흥", "수지", "양지", "모현", "포곡", "남사", "이동", "원삼", "백암",
         "구성", "신갈", "동백", "죽전", "보정", "상현", "성복", "역북", "마북", "삼가",
         "용인", "경기", "한남정맥", "석성산", "경안천"]
TRADE = {
    "토목": ["종합건설", "건설", "건영", "토건"],
    "건축": ["종합건설", "건설", "산업개발"],
    "전기": ["전기", "이엔지", "전력기술"],
    "기계": ["설비", "기계설비", "테크"],
    "환경": ["환경", "환경산업", "이엔브이"],
    "조경": ["조경", "그린", "산림"],
    "안전": ["안전기술원", "안전진단", "구조안전"],
    "정보": ["정보통신", "시스템", "아이티에스"],
    "서비스": ["서비스", "시설관리", "산업"],
    "물품": ["물산", "상사", "유통"],
}
SUFFIX = ["(주)", "(주)", "(주)", "㈜", "주식회사 ", ""]
used = set()


def firm(kind, i):
    for _ in range(40):
        nm = PLACE[(i * 7 + random.randint(0, 24)) % len(PLACE)] + random.choice(TRADE[kind])
        if nm not in used:
            used.add(nm)
            s = SUFFIX[i % len(SUFFIX)]
            return (s + nm) if s.endswith(" ") else (nm + s)
    return "용인" + random.choice(TRADE[kind]) + str(i)


# ── 계약 목록 — (부서, 구분, 업종, 계약명, 금액 만원, 자산구분) ──────
# 지자체가 실제로 발주하는 이름의 결을 따랐다.
PLAN = [
    # 도로·교량·터널 (D03)
    ("D03", "공사", "토목", "{y}년 시도 포장보수 공사(처인구)", 128000, None),
    ("D03", "공사", "토목", "{y}년 시도 포장보수 공사(기흥·수지구)", 154000, None),
    ("D03", "공사", "토목", "{y}년 교량 받침·신축이음 보수공사", 86000, "교량"),
    ("D03", "공사", "토목", "{y}년 터널 조명·제트팬 개량공사", 112000, "터널"),
    ("D03", "용역", "안전", "{y}년 제1·2종 교량 정밀안전점검 용역", 42000, "교량"),
    ("D03", "용역", "안전", "{y}년 터널 정밀안전진단 용역", 38000, "터널"),
    ("D03", "용역", "안전", "{y}년 소규모 공공시설 안전점검 용역", 9500, None),
    ("D03", "용역", "서비스", "{y}년 도로시설물 유지관리 용역(처인구)", 67000, None),
    ("D03", "용역", "서비스", "{y}년 도로시설물 유지관리 용역(기흥구)", 71000, None),
    ("D03", "용역", "서비스", "{y}년 겨울철 제설 대행 용역", 58000, None),
    ("D03", "공사", "전기", "{y}년 도로 가로등·보안등 정비공사", 45000, None),
    ("D03", "용역", "정보", "{y}년 도로 CCTV·전광판 유지관리 용역", 23000, None),
    # 상수도 (D04)
    ("D04", "공사", "토목", "{y}년 노후 상수관로 교체공사(1공구)", 289000, None),
    ("D04", "공사", "토목", "{y}년 노후 상수관로 교체공사(2공구)", 246000, None),
    ("D04", "위탁", "환경", "{y}~{y2}년 정수장 약품 운반·투입 위탁", 74000, None),
    ("D04", "용역", "환경", "{y}년 수질검사 대행 용역", 18000, None),
    ("D04", "공사", "기계", "{y}년 가압장 펌프·전동기 교체공사", 93000, None),
    ("D04", "용역", "안전", "{y}년 배수지 안전점검·청소 용역", 27000, None),
    ("D04", "공사", "전기", "{y}년 정수장 수배전반 개선공사", 61000, None),
    ("D04", "용역", "정보", "{y}년 상수도 원격감시(SCADA) 유지관리", 21000, None),
    # 하수 (D05)
    ("D05", "공사", "기계", "{y}년 하수처리장 기계설비 정비공사", 168000, None),
    ("D05", "용역", "환경", "{y}년 하수관로 준설·청소 용역", 92000, None),
    ("D05", "용역", "안전", "{y}년 하수관로 정밀조사 용역", 34000, None),
    ("D05", "위탁", "환경", "{y}~{y2}년 공공하수처리시설 운영 위탁", 1480000, None),
    ("D05", "공사", "토목", "{y}년 우수관로 정비공사(침수취약지역)", 137000, None),
    ("D05", "용역", "안전", "{y}년 밀폐공간 작업 안전관리 용역", 12000, None),
    # 청사·건축물 (D09)
    ("D09", "용역", "서비스", "{y}~{y2}년 시청사 청소·경비 용역", 276000, "건축물"),
    ("D09", "용역", "기계", "{y}년 청사 냉난방·공조설비 유지관리", 88000, "건축물"),
    ("D09", "용역", "안전", "{y}년 승강기 유지관리 용역(책임보전형)", 64000, None),
    ("D09", "공사", "건축", "{y}년 공공청사 옥상방수·외벽 보수공사", 119000, "건축물"),
    ("D09", "용역", "안전", "{y}년 공공건축물 정기안전점검 용역", 31000, "건축물"),
    ("D09", "공사", "전기", "{y}년 청사 소방·전기설비 개선공사", 72000, "건축물"),
    ("D09", "용역", "정보", "{y}년 청사 통합관제 시스템 유지관리", 26000, None),
    # 공원·녹지 (D06)
    ("D06", "용역", "조경", "{y}년 도시공원 수목관리·전지 용역", 143000, None),
    ("D06", "용역", "서비스", "{y}년 공원 시설물 유지보수 용역", 58000, None),
    ("D06", "용역", "안전", "{y}년 어린이놀이시설 안전점검 용역", 8700, None),
    ("D06", "공사", "조경", "{y}년 근린공원 시설 개선공사", 97000, None),
    ("D06", "용역", "조경", "{y}년 가로수 병해충 방제 용역", 26000, None),
    # 재난안전 (D13)
    ("D13", "용역", "정보", "{y}년 재난 예·경보시설 유지관리 용역", 37000, None),
    ("D13", "공사", "토목", "{y}년 급경사지 붕괴위험지역 정비공사", 214000, None),
    ("D13", "용역", "안전", "{y}년 급경사지 실태조사 용역", 16000, None),
    ("D13", "물품", "물품", "{y}년 재난관리자원(구호물자) 구매", 42000, None),
    ("D13", "용역", "정보", "{y}년 재난안전통신망 운영 지원 용역", 29000, None),
    ("D13", "공사", "토목", "{y}년 소하천 정비공사", 176000, None),
    # 보육·복지 (D07 · D11)
    ("D07", "위탁", "서비스", "{y}~{y2}년 국공립어린이집 위탁운영(A권역)", 186000, None),
    ("D07", "위탁", "서비스", "{y}~{y2}년 국공립어린이집 위탁운영(B권역)", 172000, None),
    ("D07", "물품", "물품", "{y}년 어린이집 급식 식자재 납품", 87000, None),
    ("D07", "용역", "안전", "{y}년 어린이집 실내공기질 측정 용역", 6400, None),
    ("D11", "용역", "환경", "{y}년 감염병 방역 소독 용역", 45000, None),
    ("D11", "용역", "서비스", "{y}년 보건소 의료폐기물 처리 용역", 19000, None),
    # 체육·문화 (D08 · D10)
    ("D08", "위탁", "서비스", "{y}~{y2}년 시민체육관 운영 위탁", 312000, None),
    ("D08", "용역", "안전", "{y}년 체육시설 안전점검 용역", 11000, None),
    ("D08", "공사", "건축", "{y}년 실내수영장 기계실 개보수공사", 83000, None),
    ("D10", "용역", "서비스", "{y}년 공영주차장 관리 용역", 96000, None),
    ("D10", "용역", "안전", "{y}년 기계식주차장 정기검사 대행 용역", 7200, None),
    ("D10", "용역", "정보", "{y}년 경전철 역사 승강설비 유지관리", 118000, None),
    # 안전총괄·총괄 (D01 · D02)
    ("D02", "용역", "안전", "{y}년 안전보건 위험성평가 컨설팅 용역", 24000, None),
    ("D02", "용역", "안전", "{y}년 중대재해 예방 교육 위탁 용역", 13000, None),
    ("D01", "용역", "정보", "{y}년 안전보건관리체계 시스템 구축 용역", 168000, None),
    ("D01", "용역", "안전", "{y}년 작업환경측정·특수건강진단 용역", 21000, None),
    ("D02", "용역", "안전", "{y}년 도급사업 안전보건 수준평가 용역", 9800, None),
    # 그 밖
    ("D12", "용역", "환경", "{y}년 생활폐기물 수집·운반 대행(1권역)", 890000, None),
    ("D12", "용역", "환경", "{y}년 생활폐기물 수집·운반 대행(2권역)", 760000, None),
    ("D12", "용역", "환경", "{y}년 재활용품 선별처리 위탁", 340000, None),
    ("D14", "용역", "안전", "{y}년 공공건설공사 안전관리 자문 용역", 15000, None),
    ("D14", "용역", "토목", "{y}년 건설공사 품질시험 대행 용역", 33000, None),
    ("D05", "공사", "전기", "{y}년 하수처리장 전기설비 개선공사", 104000, None),
    ("D04", "용역", "서비스", "{y}년 상수도 검침·고객지원 용역", 129000, None),
    ("D09", "물품", "물품", "{y}년 청사 안전보호구·소방용품 구매", 13500, None),
    ("D06", "용역", "서비스", "{y}년 공원 화장실 청소 용역", 41000, None),
    ("D03", "물품", "물품", "{y}년 도로표지·교통안전시설 자재 구매", 68000, None),
]

METHOD = ["제한경쟁입찰", "제한경쟁입찰", "일반경쟁입찰", "수의계약(2인견적)", "협상에 의한 계약"]

# 계약 구분별 위험요인
HAZ = {
    "공사": [("작업 구간", "추락·낙하", "높음", "안전난간·안전대 착용·낙하물 방지망 설치"),
             ("중장비 반입로", "협착·충돌", "높음", "유도자 배치·작업구역 통제·후방감지기"),
             ("전기 인입부", "감전", "보통", "작업 전 검전·절연 보호구·활선작업 금지"),
             ("자재 적치장", "전도·붕괴", "보통", "적재 높이 제한·받침 고정")],
    "용역": [("작업 구간", "추락·전도", "보통", "안전난간·미끄럼 주의 표지·정리정돈"),
             ("차도 인접 구간", "차량 충돌", "높음", "신호수 배치·차선 통제·반사조끼 착용"),
             ("이동 동선", "미끄러짐", "낮음", "작업 전 동선 점검·야간 조명")],
    "위탁": [("취급 구역", "화학물질 노출", "높음", "보호구 지급·MSDS 비치·국소배기"),
             ("밀폐공간", "질식", "높음", "산소·유해가스 측정·환기·감시인 배치"),
             ("적재 구역", "전도·낙하", "보통", "적재 높이 제한·고정")],
    "물품": [("하역 구역", "차량 충돌", "보통", "하역 시간 분리·유도자 배치"),
             ("창고", "전도", "낮음", "적재 기준 준수·지게차 운행로 분리")],
}
# 업종이 특별한 위험을 더 얹는다
HAZ_TRADE = {
    "환경": ("처리시설 내부", "유해가스·질식", "높음", "가스 측정·송기마스크·구조 장비 대기"),
    "조경": ("고소 전지 작업", "추락", "높음", "고소작업대 사용·안전대 착용"),
    "전기": ("수배전반", "감전·아크", "높음", "정전 작업 원칙·검전 확인·아크 보호복"),
    "기계": ("회전기기 정비", "협착", "높음", "전원 차단·잠금표지(LOTO)"),
    "안전": ("점검 통로", "추락", "보통", "점검발판·안전대 부착설비"),
}

i_duties = [d["duty_key"] for d in duty if d.get("area") == "I"]
f_duties = [d["duty_key"] for d in duty if d.get("area") == "F"]

contracts, hazards, cduties = [], [], []
hz_i = cd_i = 0

for i, (dept, kind, trade, name_t, amt_man, want_asset) in enumerate(PLAN, 1):
    cid = "CTR-%04d" % i
    multi = "{y2}" in name_t
    y = 2026
    start = dt.date(y, random.randint(1, 7), random.randint(1, 28))
    end = start + dt.timedelta(days=(720 if multi else 330))
    amount = amt_man * 10000
    name = name_t.format(y=y, y2=y + 1)

    # 안전보건 조항 — 공사·위탁은 거의 있고, 물품은 드물다(시연에서 짚을 구멍)
    has_clause = {"공사": 0.95, "용역": 0.85, "위탁": 0.9, "물품": 0.35}[kind] > random.random()
    # 수급인 안전보건 수준 평가 — 금액이 클수록 했을 가능성이 높다
    evaluated = amount >= 100000000 and random.random() < 0.8
    score = random.randint(68, 96) if evaluated else ""
    a = ""
    if want_asset and asset_by_kind.get(want_asset):
        a = random.choice(asset_by_kind[want_asset])["asset_id"]

    contracts.append({
        "contract_id": cid, "contract_name": name, "counterpart": firm(trade, i),
        "asset_id": a, "dept_id": dept, "contract_type": kind,
        "start_date": start.isoformat(), "end_date": end.isoformat(), "amount": amount,
        "safety_clause": "안전보건 확보 조항 %s" % ("있음" if has_clause else "없음"),
        "evaluation_done": "Y" if evaluated else "N",
        # 새 칸
        "contract_method": random.choice(METHOD),
        "trade": trade,
        "safety_cost": int(amount * random.uniform(0.018, 0.031)) if kind == "공사" else "",
        "worker_cnt": random.randint(3, 45) if kind != "물품" else random.randint(1, 5),
        "subcontract": "Y" if (kind == "공사" and random.random() < 0.45) else "N",
        "eval_score": score,
        "eval_date": (start + dt.timedelta(days=random.randint(5, 40))).isoformat() if evaluated else "",
        "manager_staff_id": (staff_by_dept.get(dept) or ["SD01-1"])[0],
        "note": EX,
    })

    # 위험요인
    pool = list(HAZ[kind])
    if trade in HAZ_TRADE:
        pool = [HAZ_TRADE[trade]] + pool
    # 위험도 — 표의 기본값을 그대로 쓰면 「높음」이 전체의 86%가 된다(실제와 다르다).
    # 위험도가 정말 높은 자리만 높음으로 둔다: 공사의 첫 위험요인, 밀폐공간·활선·회전기기 업종,
    # 그 밖에는 낮춰 잡는다. 이렇게 하면 「높음」이 든 계약이 30% 안팎이 된다.
    HIGH_TRADE = ("환경", "전기", "기계")
    for j, (pl, hz, lv, ms) in enumerate(pool[:random.randint(2, 4)], 1):
        if lv == "높음":
            keep = (kind == "공사" and j == 1) or (trade in HIGH_TRADE and j == 1)                    or random.random() < 0.12
            if not keep:
                lv = "보통" if random.random() < 0.7 else "낮음"
        hz_i += 1
        hazards.append({
            "hazard_id": "HZD-%04d-%d" % (i, j), "contract_id": cid,
            "hazard_place": pl, "hazard_factor": hz, "risk_level": lv, "measure": ms,
        })

    # 걸리는 의무 — 산업(I) 위주로, 시설 성격이면 F 도 섞는다
    pool_d = i_duties[:] if kind != "물품" else i_duties[:20]
    if want_asset:
        pool_d = pool_d + f_duties[:40]
    for j in range(random.randint(2, 5)):
        cd_i += 1
        dk = pool_d[(i * 11 + j * 7) % len(pool_d)]
        st = ["이행대기", "이행완료", "점검완료", "조치필요"][(i + j) % 4]
        cduties.append({
            "cduty_id": "CDT-%04d-%d" % (i, j + 1), "contract_id": cid, "duty_key": dk,
            "status": st,
            "done_at": (start + dt.timedelta(days=random.randint(20, 200))).isoformat()
                       if st in ("이행완료", "점검완료") else "",
            "evidence_id": "", "note": EX,
        })

print("계약 %d건 · 위험요인 %d건 · 걸린 의무 %d건" % (len(contracts), hz_i, cd_i))
wr("contract", contracts,
   ["contract_id", "contract_name", "counterpart", "asset_id", "dept_id", "contract_type",
    "start_date", "end_date", "amount", "safety_clause", "evaluation_done",
    "contract_method", "trade", "safety_cost", "worker_cnt", "subcontract",
    "eval_score", "eval_date", "manager_staff_id", "note"])
wr("contract_hazard", hazards,
   ["hazard_id", "contract_id", "hazard_place", "hazard_factor", "risk_level", "measure"])
wr("contract_duty", cduties,
   ["cduty_id", "contract_id", "duty_key", "status", "done_at", "evidence_id", "note"])

n_clause = sum(1 for c in contracts if "있음" in c["safety_clause"])
n_eval = sum(1 for c in contracts if c["evaluation_done"] == "Y")
n_sub = sum(1 for c in contracts if c["subcontract"] == "Y")
tot = sum(c["amount"] for c in contracts)
print("\n시연에서 짚을 것")
print("  안전보건 조항 있음 %d / 없음 %d" % (n_clause, len(contracts) - n_clause))
print("  수급인 안전보건 수준평가 완료 %d / 미실시 %d" % (n_eval, len(contracts) - n_eval))
print("  재하도급 있음 %d" % n_sub)
print("  계약금액 합계 %,d원" .replace(",", ",") % tot if False else "  계약금액 합계 {:,}원".format(tot))
print("\n판 폴더: %s" % OUT)
print("★ 업체 이름은 용인 지명 + 업종어로 새로 지었다. 실존 업체가 아니다.")
