# -*- coding: utf-8 -*-
"""
데모 2차 운영 DB — ops_v0.3 시드 생성기 (2026-09-21)

무엇을 채우는가
  v0.1/v0.2 를 실측해 보니 **빈 표**가 있었다: evidence 0 · inspection 0 · action 0 · notification 0.
  이행완료 과제가 1,018 건인데 증빙이 한 건도 없으면 화면이 비어 보이고, 시연에서 「완료라는 근거가 뭐냐」에
  답할 수 없다. 그래서 완료된 과제에 맞는 증빙·점검·조치·알림을 만들어 채운다.
  또 중대산업재해(I) 쪽 과제가 117 건뿐이라 도급·위험성평가를 보태 산업재해 이야기를 세운다.

규칙
  · 모든 행은 note 에 「예시 데이터(시연용)」로 표시한다. 실제 자료가 아니다.
  · 실명은 쓰지 않는다. 담당자는 staff.csv 의 직책명 그대로 쓴다.
  · 발행된 판(ops_v0.1·v0.2)은 **덮어쓰지 않는다**. 새 판 폴더 ops_v0.3_20260921 에만 쓴다.
  · 난수는 씨앗을 고정해 다시 돌려도 같은 값이 나오게 한다.
"""
import csv, io, os, random, datetime as dt

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V1 = os.path.join(BASE, "ops_v0.1_20260920", "seed")
V2 = os.path.join(BASE, "ops_v0.2_20260920", "seed")
OUT = os.path.join(BASE, "ops_v0.3_20260921", "seed")
os.makedirs(OUT, exist_ok=True)
random.seed(20260921)
EX = "예시 데이터(시연용)"
TODAY = dt.date(2026, 9, 21)


def rd(d, name):
    with io.open(os.path.join(d, name + ".csv"), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def wr(name, rows, cols):
    p = os.path.join(OUT, name + ".csv")
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in cols})
    print("  %-22s %6d행" % (name + ".csv", len(rows)))


duty = {r["duty_key"]: r for r in rd(V1, "duty_class")}
asg = {r["assign_id"]: r for r in rd(V1, "duty_assignment")}
task = rd(V1, "compliance_task")
staff = rd(V1, "staff")
dept = rd(V1, "org_dept")
asset = rd(V1, "asset")
forms = rd(V1, "form_template")
patch = {r["task_id"]: r for r in rd(V2, "task_approval_patch")}

staff_by_dept = {}
for s in staff:
    staff_by_dept.setdefault(s["dept_id"], []).append(s["staff_id"])
forms_by_doc = {}
for f in forms:
    forms_by_doc.setdefault(f["doc_id"], []).append(f["form_id"])


# ── 점검반 — 관리자급 ───────────────────────────────────────────
# 실측해 보니 조직에 **관리자급이 한 명도 없었다**(28명 전부 주무관), 점검자도 한 사람으로 고정돼 있었다.
# 지자체 현실대로 점검반을 세운다: 안전총괄과 과장·팀장이 점검하고, 중대재해예방과 과장이 총괄한다.
# staff_id 는 기존 대역(SD..)과 겹치지 않게 SM.. 을 쓴다.
MANAGERS = [
    ("SM01-1", "한서연 과장", "D01", "총괄과장"),
    ("SM02-1", "오지훈 과장", "D02", "점검총괄"),
    ("SM02-2", "서다혜 팀장", "D02", "점검팀장"),
    ("SM02-3", "권성민 팀장", "D02", "점검팀장"),
]
INSPECTORS = [m[0] for m in MANAGERS[1:]]   # 실제로 현장을 도는 세 사람


def ctx(t):
    """과제 → (배정, 의무) 묶음."""
    a = asg.get(t["assign_id"], {})
    return a, duty.get(a.get("duty_key", ""), {})


# ── 0. 과제 상태 재배분 ─────────────────────────────────────────
# v0.1 은 기간초과가 670건(24.7%)이었다. 넉 달 치를 한꺼번에 밀린 것처럼 보여
# 「실감이 안 난다」는 지적(사용자 09-21). 기한이 지난 과제 대부분은 이미 한 것으로 보고,
# 10% 남짓만 밀린 것으로 둔다. 상태는 기한과 어긋나지 않게 맞춘다.
#   기한이 지났으면 → 이행완료(80%) · 기간초과(17%) · 조치필요(3%)
#   기한이 남았으면 → 이행대기(80%) · 미리 끝낸 것(20%)
# 부서마다 형편이 다르다. 전부 40% 언저리면 「부서별 진도」 화면이 아무 말도 하지 못한다
# (사용자 지적 09-21). 잘 하는 부서와 밀린 부서를 갈라 둔다 — 시연에서 짚을 자리가 생긴다.
DEPT_RATE = {
    "D01": 0.88,  # 중대재해예방과 — 총괄이라 자기 것은 챙긴다
    "D02": 0.83,  # 안전총괄과
    "D11": 0.86,  # 보건소
    "D07": 0.78,  # 보육정책과
    "D13": 0.71,  # 재난안전과
    "D09": 0.64,  # 건축과
    "D06": 0.58,  # 공원녹지과
    "D03": 0.49,  # 도로과 — 대상이 많아 밀린다
    "D08": 0.44,  # 체육진흥과
    "D10": 0.41,  # 교통정책과
    "D04": 0.36,  # 상수도사업소 — 가장 밀린 곳
    "D05": 0.33,  # 하수도과
    "D12": 0.52,
    "D14": 0.60,
}


def rebalance(t, i):
    try:
        dd = dt.date.fromisoformat(t["due_date"])
    except Exception:
        return t
    a, _ = ctx(t)

    # ① 기한이 7일 격자에 놓여 같은 날짜가 무더기로 생겼다 — 앞뒤로 흩는다.
    jitter = ((i * 13 + len(t["task_id"]) * 7) % 13) - 6      # -6 ~ +6일
    dd = dd + dt.timedelta(days=jitter)
    t["due_date"] = dd.isoformat()

    # ② 부서 형편을 반영한다.
    rate = DEPT_RATE.get(a.get("dept_id", ""), 0.55)
    r = ((i * 37 + len(t["task_id"]) * 11 + jitter * 3) % 100) / 100.0

    if dd < TODAY:
        # 기한이 지난 것은 시간이 있었으니 대체로 끝냈다 — 부서 형편에 +0.30.
        rate_pd = min(0.95, rate + 0.30)
        if r < rate_pd:
            t["status"] = "점검완료" if (i % 4 == 0) else "이행완료"
            t["done_at"] = (dd - dt.timedelta(days=(i % 12) + 1)).isoformat()
        elif r < rate_pd + (1 - rate_pd) * 0.75:
            t["status"] = "기간초과"; t["done_at"] = ""
        else:
            t["status"] = "조치필요"; t["done_at"] = ""
    else:
        # 기한 전이라도 부지런한 부서는 미리 해 둔다.
        if r < rate * 0.35:
            t["status"] = "이행완료"
            t["done_at"] = (TODAY - dt.timedelta(days=(i % 20) + 1)).isoformat()
        else:
            t["status"] = "이행대기"; t["done_at"] = ""
    t["done_by"] = a.get("owner_staff_id", "") if t["done_at"] else ""
    return t


task = [rebalance(dict(t), i) for i, t in enumerate(task)]
_c = {}
for t in task:
    _c[t["status"]] = _c.get(t["status"], 0) + 1
print("[0] 과제 상태 재배분 — " + " · ".join("%s %d" % kv for kv in sorted(_c.items())))
wr("compliance_task", task,
   ["task_id", "assign_id", "period_label", "due_date", "status", "done_at", "done_by", "remark"])


# ── 1. 증빙 — 완료된 과제에 하나씩 ────────────────────────────────
KIND_BY_T = {
    "T01": "계획서", "T02": "임명·선임 문서", "T03": "교육일지", "T04": "점검표",
    "T05": "점검표", "T06": "작업일지", "T07": "관리대장", "T08": "측정결과표",
    "T09": "훈련 결과보고서", "T10": "보고·게시 증빙",
}
NAME_BY_T = {
    "T01": "{y}년 {n} 계획서", "T02": "{n} 선임 통보서", "T03": "{y}년 {h} {n} 교육일지",
    "T04": "{y}년 {h} {n} 점검 결과표", "T05": "{n} 기준 적합 확인서",
    "T06": "{y}-{m:02d} {n} 작업일지", "T07": "{n} 관리대장", "T08": "{y}년 {h} {n} 측정 결과표",
    "T09": "{y}년 {n} 훈련 결과보고서", "T10": "{y}년 {h} {n} 보고 공문",
}

evidence, inspection, action, notification = [], [], [], []
insp_by_task = {}
ei = ii = ai = ni = 0

for t in task:
    a, d = ctx(t)
    st = t["status"]
    pt = patch.get(t["task_id"], {})
    half = pt.get("half_year") or ("상반기" if t["due_date"][5:7] <= "06" else "하반기")
    who = a.get("owner_staff_id") or (staff_by_dept.get(a.get("dept_id", ""), ["SD01-1"])[0])
    impl = (d.get("impl_type") or "T04")[:3]
    short = (d.get("duty_name") or d.get("code36_name") or "안전 의무")[:26]

    if st in ("이행완료", "점검완료"):
        ei += 1
        done = t.get("done_at") or t["due_date"]
        nm = NAME_BY_T.get(impl, "{y}년 {n} 증빙").format(
            y=done[:4], m=int(done[5:7]), h=half, n=short)
        fid = (forms_by_doc.get(d.get("doc_id", ""), [""]) or [""])[0]
        evidence.append({
            "evidence_id": "EVD-%06d" % ei, "task_id": t["task_id"],
            "evidence_kind": KIND_BY_T.get(impl, "점검표"),
            "file_name": nm + (".pdf" if impl != "T06" else ".xlsx"),
            "file_url": "", "form_id": fid, "uploaded_by": who,
            "uploaded_at": done, "note": EX,
        })
        # 사진을 하나 더 붙이는 경우
        if impl in ("T04", "T05") and ei % 4 == 0:
            ei += 1
            evidence.append({
                "evidence_id": "EVD-%06d" % ei, "task_id": t["task_id"],
                "evidence_kind": "사진", "file_name": "%s 현장사진.zip" % short,
                "file_url": "", "form_id": "", "uploaded_by": who,
                "uploaded_at": done, "note": EX,
            })

    # ★ 판정이 끝난 것에는 **반드시** 점검 기록이 있어야 한다.
    #   전에는 「점검완료」에만 만들어, 반려된 43건의 점검일·점검자가 공란이었다(사용자 지적 09-21).
    #   점검완료 → 적합 · 조치필요 → 보완필요/부적합 으로 갈라 전부 만든다.
    if st in ("점검완료", "조치필요"):
        ii += 1
        base = t.get("done_at") or t["due_date"]
        insp_date = min(dt.date.fromisoformat(base) + dt.timedelta(days=3 + (ii * 5) % 18), TODAY)
        who_insp = INSPECTORS[ii % len(INSPECTORS)]
        if st == "점검완료":
            res = "적합"
            finding = ""
        else:
            res = "부적합" if ii % 5 == 0 else "보완필요"
            # 의견이 한 문장으로 몰리지 않게 섞는다(ii 만 쓰면 같은 값이 반복된다).
            pick = (ii * 7 + len(t["task_id"]) * 3 + len(short)) % 6
            finding = (["기한이 지나 미이행 — 즉시 조치 후 재제출",
                        "점검 자체를 실시하지 않음 — 이행계획 제출 요망",
                        "법정 주기를 넘김 — 조치 계획과 함께 보고"][pick % 3]
                       if res == "부적합" else
                       ["증빙 일부 누락 — 결과표 첨부 필요",
                        "점검 주기 미준수 — 다음 회차에 반영",
                        "서식 미사용 — 법정 서식으로 다시 제출",
                        "지적사항 조치 결과 미첨부",
                        "점검자 서명 누락 — 보완 후 재제출",
                        "사진 자료 없음 — 현장 사진 첨부"][pick])
        inspection.append({
            "insp_id": "INS-%06d" % ii, "task_id": t["task_id"],
            "inspector_staff_id": who_insp,
            "insp_date": insp_date.isoformat(),
            "result": res, "finding": finding, "note": EX,
        })
        insp_by_task[t["task_id"]] = (insp_date.isoformat(), who_insp, res)

        if res != "적합":
            ai += 1
            due = insp_date + dt.timedelta(days=30)
            fin = ai % 3 != 0      # 3건 중 2건은 조치 완료
            action.append({
                "action_id": "ACT-%06d" % ai, "insp_id": "INS-%06d" % ii,
                "action_type": "보완" if res == "보완필요" else "시정",
                "due_date": due.isoformat(),
                "done_at": (due - dt.timedelta(days=random.randint(1, 10))).isoformat() if fin else "",
                "result": "완료" if fin else "진행 중", "note": EX,
            })

    # 알림 — 기한이 지났거나 30일 안에 닥친 것
    try:
        dd = dt.date.fromisoformat(t["due_date"])
    except Exception:
        continue
    gap = (dd - TODAY).days
    if st == "기간초과" and gap < 0 and ni < 400:
        # 기한이 지난 뒤 1~6일에 보냈다고 본다. 그 날이 아직 안 왔으면 만들지 않는다.
        sent_over = dd + dt.timedelta(days=1 + (ni * 3 + len(short)) % 6)
        if sent_over > TODAY:
            continue
        ni += 1
        notification.append({
            "notif_id": "NTF-%06d" % ni, "task_id": t["task_id"],
            "notif_type": "기한초과", "to_staff_id": who,
            "sent_at": sent_over.isoformat(),
            "message": "[기한초과] %s — 기한 %s (%d일 경과)" % (short, t["due_date"], -gap),
            "read_at": "", "note": EX,
        })
    elif 0 <= gap <= 60 and ni < 520:
        # 보낸 날 = 기한 며칠 전. **오늘로 자르지 않는다** — 자르면 325건 중 211건이
        # 같은 날짜(오늘)로 뭉쳐 「기한임박 날짜가 다 똑같다」가 된다(사용자 지적 09-21).
        # 대신 **이미 보냈어야 할 것만** 만든다: 보낸 날이 오늘보다 뒤면 아직 안 보낸 것이므로 건너뛴다.
        # 앞당김 폭을 3~45일로 넓혀 최근 6주에 고르게 퍼지게 한다.
        lead = 3 + (ni * 11 + len(t["task_id"]) * 5 + len(short)) % 43
        sent = dd - dt.timedelta(days=lead)
        if sent > TODAY:
            continue                      # 아직 보낼 때가 아니다
        left = (dd - sent).days
        ni += 1
        notification.append({
            "notif_id": "NTF-%06d" % ni, "task_id": t["task_id"],
            "notif_type": "기한임박", "to_staff_id": who,
            "sent_at": sent.isoformat(),
            "message": "[기한임박] %s — 기한 %s (보낼 때 %d일 남음)" % (short, t["due_date"], left),
            "read_at": "", "note": EX,
        })

print("[1] 증빙·점검·조치·알림")
wr("evidence", evidence, ["evidence_id", "task_id", "evidence_kind", "file_name", "file_url",
                          "form_id", "uploaded_by", "uploaded_at", "note"])
wr("inspection", inspection, ["insp_id", "task_id", "inspector_staff_id", "insp_date",
                              "result", "finding", "note"])
wr("action", action, ["action_id", "insp_id", "action_type", "due_date", "done_at", "result", "note"])
wr("notification", notification, ["notif_id", "task_id", "notif_type", "to_staff_id",
                                  "sent_at", "message", "read_at", "note"])

# ── 2. 위험성평가 — 중대산업재해(I) 쪽 뼈대 ──────────────────────
# 시행령 제4조제3호 「유해·위험요인을 확인·개선하는 절차」의 실물.
RISK_SITES = [
    ("D04", "정수장 약품 투입실", "염소 누출", "화학", "높음", "누출 감지기·보호구 비치·2인 1조 작업"),
    ("D04", "배수지 유지보수", "밀폐공간 질식", "질식", "높음", "산소농도 측정·환기·감시인 배치"),
    ("D05", "하수처리장 침전지", "추락", "추락", "높음", "안전난간·안전대 착용·개구부 덮개"),
    ("D03", "도로 포장 보수 현장", "차량 충돌", "교통", "높음", "신호수 배치·차선 통제·야간 경광등"),
    ("D03", "터널 점검 통로", "협착·전도", "기계", "보통", "점검차 안전장치·미끄럼 방지"),
    ("D09", "청사 승강기 기계실", "감전", "전기", "보통", "절연 보호구·전원 차단 확인"),
    ("D06", "공원 수목 전지 작업", "추락", "추락", "높음", "고소작업대 사용·안전대 착용"),
    ("D13", "재난 현장 수습", "붕괴", "붕괴", "높음", "현장 통제선·구조물 안전 확인 후 진입"),
    ("D05", "하수관로 준설", "질식·유해가스", "질식", "높음", "가스 측정·송기마스크·구조 장비 대기"),
    ("D09", "옥상 방수 보수", "추락", "추락", "보통", "안전난간 설치·작업 전 점검"),
    ("D04", "정수장 전기실", "감전·아크", "전기", "보통", "활선 작업 금지·검전 확인"),
    ("D03", "제설 작업", "동상·교통사고", "교통", "보통", "교대 근무·반사조끼·차량 점검"),
]
ra, ri = [], []
for i, (dp, place, hz, kind, lv, meas) in enumerate(RISK_SITES, 1):
    rid = "RSK-%03d" % i
    assessed = dt.date(2026, 3, 1) + dt.timedelta(days=i * 11)
    ra.append({
        "risk_id": rid, "title": "%s 위험성평가" % place, "dept_id": dp,
        "place": place, "method": "체크리스트법" if i % 2 else "위험성 수준 3단계 판단법",
        "assessed_at": assessed.isoformat(),
        "assessor_staff_id": staff_by_dept.get(dp, ["SD01-1"])[0],
        "worker_joined": "Y", "review_cycle": "연 1회",
        "next_due": dt.date(assessed.year + 1, assessed.month, assessed.day).isoformat(),
        "status": "완료" if i % 5 else "진행 중", "note": EX,
    })
    for j, (f, l, m) in enumerate([(hz, lv, meas),
                                   ("작업 전 안전점검 미실시", "보통", "작업 전 TBM 실시·기록"),
                                   ("보호구 미착용", "낮음" if i % 3 else "보통", "보호구 지급·착용 점검")], 1):
        ri.append({
            "risk_item_id": "%s-%d" % (rid, j), "risk_id": rid,
            "hazard_factor": f, "hazard_kind": kind if j == 1 else "관리",
            "risk_level": l, "measure": m,
            "measure_due": (assessed + dt.timedelta(days=30 * j)).isoformat(),
            "measure_done_at": (assessed + dt.timedelta(days=30 * j - 5)).isoformat() if (i + j) % 4 else "",
            "owner_staff_id": staff_by_dept.get(dp, ["SD01-1"])[0], "note": EX,
        })

print("[2] 위험성평가")
wr("risk_assessment", ra, ["risk_id", "title", "dept_id", "place", "method", "assessed_at",
                           "assessor_staff_id", "worker_joined", "review_cycle", "next_due", "status", "note"])
wr("risk_assessment_item", ri, ["risk_item_id", "risk_id", "hazard_factor", "hazard_kind",
                                "risk_level", "measure", "measure_due", "measure_done_at",
                                "owner_staff_id", "note"])

# ── 3. 도급 계약 보강 — v0.2 24건 + 산업안전 성격의 공사·용역 ──────
c_old = rd(V2, "contract")
h_old = rd(V2, "contract_hazard")
d_old = rd(V2, "contract_duty")
NEW_C = [
    ("하수처리장 기계설비 정비 공사", "○○플랜트", "D05", "공사", 420000000, "있음", "Y"),
    ("정수장 약품 운반·투입 위탁", "○○케미칼", "D04", "위탁", 180000000, "있음", "Y"),
    ("도로 포장 보수 공사(처인구)", "○○건설", "D03", "공사", 1250000000, "있음", "Y"),
    ("교량 안전점검 용역", "○○구조안전", "D03", "용역", 96000000, "있음", "Y"),
    ("청사 승강기 유지관리", "○○엘리베이터", "D09", "용역", 68000000, "있음", "N"),
    ("공원 수목 관리 용역", "○○조경", "D06", "용역", 143000000, "없음", "N"),
    ("하수관로 준설 용역", "○○환경", "D05", "용역", 231000000, "있음", "Y"),
    ("체육시설 시설관리 위탁", "○○스포츠", "D08", "위탁", 315000000, "있음", "N"),
    ("어린이집 급식 식자재 납품", "○○푸드", "D07", "납품", 87000000, "없음", "N"),
    ("재난 예·경보 시설 유지보수", "○○정보통신", "D13", "용역", 54000000, "있음", "Y"),
    ("상수도 노후관 교체 공사", "○○종합건설", "D04", "공사", 890000000, "있음", "Y"),
    ("청사 미화·경비 용역", "○○서비스", "D09", "용역", 276000000, "있음", "N"),
]
C_HAZ = {
    "공사": [("작업 구간", "추락·낙하", "높음", "안전난간·안전모·낙하물 방지망"),
             ("중장비 반입로", "협착·충돌", "높음", "유도자 배치·작업구역 통제"),
             ("전기 인입부", "감전", "보통", "전원 차단 확인·절연 보호구")],
    "용역": [("작업 구간", "추락·전도", "보통", "안전난간·표지 설치"),
             ("이동 동선", "미끄러짐", "낮음", "미끄럼 주의 표지·정리정돈")],
    "위탁": [("취급 구역", "화학물질 노출", "높음", "보호구 지급·MSDS 비치·환기"),
             ("적재 구역", "전도·낙하", "보통", "적재 높이 제한·고정")],
    "납품": [("하역 구역", "차량 충돌", "보통", "하역 시간 분리·유도자 배치")],
}
contracts = list(c_old)
hazards = list(h_old)
n0 = len(c_old)
for i, (nm, cp, dp, ty, amt, cls, ev) in enumerate(NEW_C, n0 + 1):
    cid = "CTR-%04d" % i
    st = dt.date(2026, random.randint(1, 6), random.randint(1, 28))
    contracts.append({
        "contract_id": cid, "contract_name": nm + " 2026", "counterpart": cp,
        "asset_id": "", "dept_id": dp, "contract_type": ty,
        "start_date": st.isoformat(), "end_date": (st + dt.timedelta(days=360)).isoformat(),
        "amount": amt,
        "safety_clause": "안전보건 확보 조항 %s" % cls,
        "evaluation_done": ev, "note": EX,
    })
    for j, (pl, hz, lv, ms) in enumerate(C_HAZ.get(ty, C_HAZ["용역"]), 1):
        hazards.append({"hazard_id": "HZD-%04d-%d" % (i, j), "contract_id": cid,
                        "hazard_place": pl, "hazard_factor": hz, "risk_level": lv, "measure": ms})

print("[3] 도급 계약 (v0.2 %d + 새로 %d)" % (n0, len(NEW_C)))
wr("contract", contracts, ["contract_id", "contract_name", "counterpart", "asset_id", "dept_id",
                           "contract_type", "start_date", "end_date", "amount", "safety_clause",
                           "evaluation_done", "note"])
wr("contract_hazard", hazards, ["hazard_id", "contract_id", "hazard_place", "hazard_factor",
                                "risk_level", "measure"])

# 새 계약에도 의무를 몇 개 건다 — 산업(I) 영역 의무에서 고른다
i_duties = [k for k, v in duty.items() if v.get("area") == "I"][:60]
cd = list(d_old)
for i in range(n0 + 1, n0 + len(NEW_C) + 1):
    cid = "CTR-%04d" % i
    for j in range(3):
        dk = i_duties[(i * 3 + j) % len(i_duties)]
        cd.append({"cduty_id": "CDT-%04d-%d" % (i, j + 1), "contract_id": cid, "duty_key": dk,
                   "status": ["이행대기", "이행완료", "점검완료"][(i + j) % 3],
                   "done_at": "", "evidence_id": "", "note": EX})
wr("contract_duty", cd, ["cduty_id", "contract_id", "duty_key", "status", "done_at", "evidence_id", "note"])

# ── 4. 점검 결과(O·△·X) — 이행 상태에서 따라 나오게 ──────────────
# v0.2 는 「보완필요」가 하반기에만 몰려 상반기 현황표의 △ 가 0 이었다.
RESULT = {"이행완료": "이행완료", "점검완료": "이행완료", "조치필요": "보완필요",
          "기간초과": "미이행", "이행대기": ""}
patched = []
for t in task:
    p0 = dict(patch.get(t["task_id"], {}))
    p0["task_id"] = t["task_id"]
    p0["check_result"] = RESULT.get(t["status"], "")
    # 결재 칸은 **점검 기록과 같은 날짜·같은 사람**이어야 한다(그러지 않으면 화면이 공란으로 보인다).
    ins3 = insp_by_task.get(t["task_id"])
    p0["approved_at"] = p0["approved_by"] = p0["rejected_at"] = ""
    if t["status"] == "점검완료":
        p0["approval_status"] = "승인"
        if ins3:
            p0["approved_at"], p0["approved_by"] = ins3[0], ins3[1]
    elif t["status"] == "이행완료":
        p0["approval_status"] = "제출"
        p0["submitted_at"] = t.get("done_at", "")
        p0["submitted_by"] = ctx(t)[0].get("owner_staff_id", "")
    elif t["status"] == "조치필요":
        p0["approval_status"] = "반려"
        if ins3:
            p0["rejected_at"] = ins3[0]
            p0["reject_reason"] = "점검 결과 %s" % ins3[2]
    else:
        p0["approval_status"] = "작성중"
    p0["evidence_cnt"] = 1 if t["status"] in ("이행완료", "점검완료") else 0
    patched.append(p0)
print("[4] 점검 결과·결재 상태")
wr("task_approval_patch", patched,
   ["task_id", "approval_status", "created_by", "submitted_at", "submitted_by", "approved_at",
    "approved_by", "rejected_at", "reject_reason", "created_at", "period_year", "half_year",
    "plan_date", "evidence_cnt", "check_result"])

# ── 5. 담당자 이름 ──────────────────────────────────────────────
# 사용자 지시(09-21): 직책명 말고 사람 이름으로 보이게 한다.
# ★ 실제 용인시 공무원의 이름은 쓰지 않는다 — 이 시스템의 점검·결재 기록은 전부 지어낸 것이라
#   실존 인물에게 붙이면 허위 기록이 된다. 부서 이름은 실제 조직 이름을 그대로 쓰고,
#   사람 이름만 가상으로 둔다. staff_id 는 바꾸지 않는다(모든 표가 이 값으로 이어져 있다).
SURNAME = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권"]
GIVEN = ["민준", "서연", "도현", "지우", "현우", "수빈", "예린", "준호", "地우", "하늘",
         "성민", "지훈", "은지", "재现", "다혜", "태연", "우진", "가영", "승우", "나경",
         "동현", "혜진", "상우", "미르", "건우", "소영", "정우", "채원", "영훈", "지안"]
GIVEN = [g for g in GIVEN if all("가" <= ch <= "힣" for ch in g)]   # 깨진 글자 방어
RANK = {"정담당": "주무관", "부담당": "주무관", "총괄": "팀장"}
named = []
for i, s in enumerate(staff):
    s = dict(s)
    nm = SURNAME[i % len(SURNAME)] + GIVEN[(i * 7) % len(GIVEN)]
    s["display_name"] = "%s %s" % (nm, RANK.get(s.get("duty_role", ""), "주무관"))
    s["note"] = "가상 인물(시연용)"
    named.append(s)
# 점검반(관리자급)을 더한다 — 이 사람들이 점검하고 결재한다.
for sid, nm, dp, role_ in MANAGERS:
    named.append({
        "staff_id": sid, "display_name": nm, "dept_id": dp, "duty_role": role_,
        "email": "%s@demo.yongin.go.kr" % sid.lower().replace("-", "."),
        "phone": "", "note": "가상 인물(시연용) · 점검반",
    })
print("[5] 담당자 %d명 — 주무관 28 · 관리자급 %d(점검반)" % (len(named), len(MANAGERS)))
wr("staff", named, ["staff_id", "display_name", "dept_id", "duty_role", "email", "phone", "note"])

print("\n끝. 판 폴더: %s" % OUT)
print("★ v0.1·v0.2 는 건드리지 않았다. 화면은 새 판부터 읽는다.")
