# -*- coding: utf-8 -*-
"""
도급·명령 — ops_v0.7 (2026-09-21)

설계서(기능설계서 9장·11장)를 쓰다 드러난 불일치를 메우는 예시 자료.
v0.5 contract · v0.6 order_received 는 한 글자도 고치지 않는다(발행된 판) — 칸만 더한다.
옮긴 행의 원래 칸 값은 끝에서 전부 다시 대조한다(assert).

만드는 것 (ops_v0.7_20260921/seed/)
  · contract.csv            v0.5 71건 + 새 칸 23개
  · contract_eval_item.csv  수급인 안전관리능력 평가 10항목 표(항목 정의 · 기본 가중치)
  · order_received.csv      v0.6 17건 + doc_nature(문서 성격) · 지도·권고 예시 2건

같은 폴더의 다른 파일(system_record · eval_criteria · worker_voice 등)은 다른 작업이 만든다 — 건드리지 않는다.
같은 이름 파일이 이미 있으면 멈춘다(판 덮어쓰기 금지).

근거 조문 (법령DB unit_20260901_v2.1_before_20260920u.csv 로 확인)
  법 제5조            UNIT-0004722  단서 「…실질적으로 지배ㆍ운영ㆍ관리하는 책임이 있는 경우에 한정한다」
  법 제9조제3항       UNIT-0004745  공중이용시설 또는 공중교통수단과 관련하여 도급, 용역, 위탁 등을 행한 경우
  시행령 제4조제9호   UNIT-0004833  가·나·다목 기준·절차 마련, 반기 1회 이상 점검
  시행령 제10조제8호  UNIT-0004777  공중이용시설·공중교통수단의 운영ㆍ관리 업무의 도급 — 가·나목, 연 1회 이상 점검
근거 자료
  서울시 안내서 p.37~40(도급 5단계 · 70점 적격 · 참고 60/70/80) · p.139~141(4-6 평가 10항목, 우수5/보통3/미흡1, 기관별 가중치,
  수급인 소유·임차 시설 제외) · Q&A p.256~274(위탁 유형: 민간위탁 · 자치구 위임 · 국가 위임/재위임)
  교육자료 p.71 — 개선·시정명령은 원칙적으로 서면 행정처분만. 행정지도·권고·조언은 들어가지 않는다.

지키는 것
  · 실질 지배 판단·공중이용시설 해당 여부는 **제안값**이다. 확인한 사람·날짜 칸(control_confirmed_*)은 비워 둔다 — 판단은 사람이 한다.
  · 확실하지 않은 것은 「확인 필요」로 둔다(시설 규모·종류를 모르면 공중이용시설이라고 단정하지 않는다).
  · 기존 평가 점수는 그대로 둔다. v0.5 는 75점을 기준으로 관리의무 ①을 매겼으므로 그 사실을 eval_pass_mark=75 로 남긴다.
    항목별 세부는 없었으므로 eval_detail 은 비운다(화면은 「세부 없음」).
"""
import csv, io, os, random, datetime as dt

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V1 = os.path.join(BASE, "ops_v0.1_20260920", "seed")
V5 = os.path.join(BASE, "ops_v0.5_20260921", "seed")
V6 = os.path.join(BASE, "ops_v0.6_20260921", "seed")
OUT = os.path.join(BASE, "ops_v0.7_20260921", "seed")
MINE = ["contract", "contract_eval_item", "order_received"]
REF = dt.date(2026, 9, 21)   # 기준일 — 결과가 날마다 바뀌지 않게 고정
random.seed(20260921 + 7)
EX = "예시 데이터(시연용)"

os.makedirs(OUT, exist_ok=True)
for n in MINE:
    p = os.path.join(OUT, n + ".csv")
    if os.path.exists(p):
        raise SystemExit("멈춤 — 이미 있음: %s (판을 덮어쓰지 않는다)" % p)


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
    print("  %-24s %4d행 · %d칸" % (n + ".csv", len(rows), len(cols)))


# ════════════════════════════════════════════════════════════════
# 1. contract
# ════════════════════════════════════════════════════════════════
src = rd(V5, "contract")
orig = [dict(r) for r in src]
assert len(src) == 71
V5_COLS = list(src[0].keys())
assets = {a["asset_id"]: a for a in rd(V1, "asset")}
hmap = rd(V5, "contract_hazard_map")
comp = rd(V5, "contract_compliance")
comp2 = {r["contract_id"]: r["status"] for r in comp if r["item_no"] == "2"}

# ── 위탁 유형 ─────────────────────────────────────────────
ENTRUST = {"공사": "도급", "용역": "용역", "위탁": "민간위탁", "물품": "물품 구매"}

# ── 공중이용시설·공중교통수단 운영·관리 위탁 여부(시행령 제10조제8호) — 제안값 ──
#   자산이 걸려 있으면 자산의 중처법 판정(sapa_l2_result)을 따른다. 없으면 이름·장소로만 가린다.
TRANSIT = [("경전철", "공중교통수단 — 용인경전철은 도시철도(법 제2조제5호가목)")]
FACILITY_WORDS = ["정수장", "가압장", "배수지", "하수", "교량", "터널", "도로", "시도", "체육관", "체육시설", "어린이집",
                  "주차장", "청사", "공공건축물", "공원", "급경사지", "소하천", "수영장", "놀이시설", "승강기"]
NOT_OPS = ["컨설팅", "교육", "시스템 구축", "작업환경측정", "수준평가", "검침", "자문", "품질시험", "통신망"]


def civil_scope(c):
    a = assets.get(c["asset_id"])
    name_place = c["contract_name"] + " " + c["work_place"]
    if a:
        r = a.get("sapa_l2_result", "")
        basis = "자산 %s(%s) 중처법 판정 「%s」 %s" % (a["asset_name"], a["asset_id"], r or "없음", a.get("sapa_basis", ""))
        if r == "해당":
            return "해당", basis.strip()
        if r == "제외":
            return "해당 없음", basis.strip()
        return "확인 필요", basis.strip() + " — 규모·종류 자료를 확인해야 합니다"
    for k, why in TRANSIT:
        if k in c["contract_name"]:
            return "해당", why
    if c["contract_type"] == "물품":
        return "해당 없음", "물품 구매 — 시설의 운영·관리 업무를 맡긴 것이 아님"
    if c["work_place"] == "시청사 사무 공간" or any(k in c["contract_name"] for k in NOT_OPS):
        return "해당 없음", "사무 지원·측정·자문 업무 — 공중이용시설·공중교통수단의 운영·관리 업무가 아님"
    if any(k in name_place for k in FACILITY_WORDS):
        return "확인 필요", "시설 관련 업무이나 계약에 시설이 특정되지 않음 — 공중이용시설(시행령 별표2·3) 해당 여부를 확인해야 합니다"
    return "해당 없음", "공중이용시설·공중교통수단의 운영·관리 업무가 아님"


# ── 실질 지배·운영·관리 (법 제5조 · 제9조제3항 단서) — 제안값 ──
#   수급인 시설(실험실·처리시설·차량)에서 하는 일이 섞인 계약은 「확인 필요」로 둔다.
VENDOR_SITE = {
    "CTR-0016": "수질검사는 수급인 검사실에서 함(시료 채취만 시 시설)",
    "CTR-0050": "의료폐기물 처리는 수급인 처리시설에서 함(수집만 보건소)",
    "CTR-0062": "수집·운반은 수급인 소유 차량으로 함",
    "CTR-0063": "수집·운반은 수급인 소유 차량으로 함",
    "CTR-0066": "품질시험은 수급인 시험실에서 함(시료 채취만 공사 현장)",
}


def judge_control(own, lease, repair, command, vsite):
    """화면(app/contracts/model.ts controlResult)과 같은 규칙."""
    if vsite == "Y" and own != "Y" and lease != "Y":
        return "비해당"
    if (own == "Y" or lease == "Y") and (repair == "Y" or command == "Y") and vsite != "Y":
        return "해당"
    return "확인 필요"


def control(c):
    cid, kind = c["contract_id"], c["contract_type"]
    place = c["work_place"]
    if kind == "물품":
        v = dict(own="Y", lease="N", repair="N", command="N", vsite="N")
        basis = "납품·하역 장소(%s)만 시 시설 — 작업 지시·통제 범위를 확인해야 합니다" % place
    elif cid in VENDOR_SITE:
        v = dict(own="Y", lease="N", repair="Y", command="Y", vsite="Y")
        basis = "%s — 시 시설에서 하는 작업과 수급인 시설에서 하는 작업을 나눠 판단해야 합니다" % VENDOR_SITE[cid]
    else:
        v = dict(own="Y", lease="N", repair="Y", command="Y", vsite="N")
        basis = "시 소유 시설(%s)에서 수행 · 보수·보강은 시 예산 · 작업 중지·시정 지시 가능" % place
    return v, judge_control(v["own"], v["lease"], v["repair"], v["command"], v["vsite"]), basis


# ── 작업 위험도(합격선 60/70/80 선택) — 위험요인 18항목 매핑에서 제안 ──
FIRE = {"HZ06", "HZ07", "HZ14"}          # 화재·폭발 · 질식 · 밀폐공간
RISKY = {"HZ01", "HZ05", "HZ08", "HZ09"}  # 추락 · 감전 · 붕괴 · 중장비 충돌
codes_by = {}
for m in hmap:
    codes_by.setdefault(m["contract_id"], set()).add(m["hazard_code"])


def work_risk(cid):
    cs = codes_by.get(cid, set())
    if cs & FIRE:
        return "화재·폭발·밀폐"
    if cs & RISKY:
        return "위험장소"
    return "일반"


def rnd10k(x):
    return int(round(x / 10000.0)) * 10000


NEW_COLS = [
    "entrust_type", "apply_frame", "civil_scope", "civil_basis",
    "ctl_own", "ctl_lease", "ctl_repair", "ctl_command", "ctl_vendor_site",
    "control_result", "control_basis", "control_confirmed_at", "control_confirmed_by",
    "work_risk", "eval_pass_mark", "eval_detail",
    "proc_stage", "order_at", "contract_at", "completed_at", "settled_at", "cost_planned", "cost_settled",
]

for c in src:
    cid, kind = c["contract_id"], c["contract_type"]
    start = dt.date.fromisoformat(c["start_date"])
    end = dt.date.fromisoformat(c["end_date"])
    c["entrust_type"] = ENTRUST[kind]
    cs, cb = civil_scope(c)
    c["civil_scope"], c["civil_basis"] = cs, cb
    c["apply_frame"] = "둘 다" if cs == "해당" else "산업"
    v, res, basis = control(c)
    c["ctl_own"], c["ctl_lease"], c["ctl_repair"], c["ctl_command"], c["ctl_vendor_site"] = (
        v["own"], v["lease"], v["repair"], v["command"], v["vsite"])
    c["control_result"], c["control_basis"] = res, basis
    c["control_confirmed_at"] = c["control_confirmed_by"] = ""
    c["work_risk"] = work_risk(cid)
    c["eval_pass_mark"] = "75" if c["evaluation_done"] == "Y" else ""
    c["eval_detail"] = ""
    c["order_at"] = (start - dt.timedelta(days=random.randint(21, 45))).isoformat()
    # 계약일은 비워 둔다 — v0.5 의 평가일이 계약 기간 시작보다 늦게 만들어져 있어, 시작일을 계약일로 두면
    # 「평가가 계약 뒤」가 59건 모두 뜬다(예시 자료를 만든 방식에서 생긴 것이지 사실이 아니다). 화면은 비면 계약 기간 시작을 보인다.
    c["contract_at"] = ""
    c["proc_stage"] = "준공 정산" if end < REF else "이행"
    c["completed_at"] = c["settled_at"] = c["cost_settled"] = ""
    if kind == "공사":
        c["cost_planned"] = c["safety_cost"]
    elif kind in ("용역", "위탁") and comp2.get(cid) in ("이행", "보완필요"):
        c["cost_planned"] = str(rnd10k(int(c["amount"]) * random.uniform(0.008, 0.018)))
    else:
        c["cost_planned"] = ""

cols = [x for x in V5_COLS if x != "note"] + NEW_COLS + ["note"]

# ════════════════════════════════════════════════════════════════
# 2. contract_eval_item — 평가 10항목(서울시 안내서 4-6, p.139~141)
# ════════════════════════════════════════════════════════════════
EVAL = [
    ("가", "체계", "조직·인력"),
    ("가", "체계", "안전예산 구분 관리"),
    ("가", "체계", "규정·매뉴얼"),
    ("나", "실행", "안전점검 계획"),
    ("나", "실행", "이행 확인 절차"),
    ("나", "실행", "교육·훈련"),
    ("다", "운영", "재해 대응 체계"),
    ("다", "운영", "비상 대책"),
    ("라", "발생 이력", "최근 3년 중대재해 발생·행정처분"),
    ("마", "장비", "안전장비"),
]
eval_rows = []
for i, (g, gn, name) in enumerate(EVAL, 1):
    eval_rows.append({
        "item_no": i, "item_code": "EV%02d" % i, "group_code": g, "group_name": gn, "item_name": name,
        "pt_good": 5, "pt_mid": 3, "pt_low": 1,
        "mid_hint": "과태료" if g == "라" else "", "low_hint": "영업정지" if g == "라" else "",
        "default_weight": 2,
        "source": "서울시 중대재해 예방 안내서 4-6 수급자 안전관리능력 평가(p.139~141)",
        "basis": "시행령 제4조제9호가목 · 시행령 제10조제8호가목",
        "basis_unit_id": "UNIT-0004835 · UNIT-0004778",
    })
assert len(eval_rows) == 10
EVAL_COLS = ["item_no", "item_code", "group_code", "group_name", "item_name", "pt_good", "pt_mid", "pt_low",
             "mid_hint", "low_hint", "default_weight", "source", "basis", "basis_unit_id"]

# ════════════════════════════════════════════════════════════════
# 3. order_received — 문서 성격
# ════════════════════════════════════════════════════════════════
ords = rd(V6, "order_received")
ord_orig = [dict(r) for r in ords]
assert len(ords) == 17
V6_COLS = list(ords[0].keys())
for o in ords:
    # v0.6 의 17건은 모두 관계 법령에 따른 공문 명령(시정조치·조치명령·개선명령)이다.
    o["doc_nature"] = "서면 행정처분"
ADVICE = [
    {"order_id": "ORD-018", "received_at": "2026-08-27", "issuer": "고용노동부(경기지청)", "issuer_kind": "중앙행정기관",
     "law": "산업안전보건법", "law_article": "", "order_no": "경기지청-2026-0827(가상)",
     "content": "여름철 폭염 대비 옥외작업 휴식시간 부여 권고(자율점검 안내문)",
     "due_date": "", "dept_id": "D06", "asset_id": "", "place": "관내 도시공원·녹지", "result": "참고",
     "doc_nature": "지도·권고·조언"},
    {"order_id": "ORD-019", "received_at": "2026-09-08", "issuer": "경기도", "issuer_kind": "지방자치단체",
     "law": "재난 및 안전관리 기본법", "law_article": "", "order_no": "경기도-2026-0908(가상)",
     "content": "추석 연휴 대비 다중이용시설 안전관리 강화 협조 요청",
     "due_date": "", "dept_id": "D09", "asset_id": "", "place": "시청사·공공건축물", "result": "참고",
     "doc_nature": "지도·권고·조언"},
]
for a in ADVICE:
    a["note"] = EX
    ords.append(a)
ORD_COLS = [x for x in V6_COLS if x != "note"] + ["doc_nature", "note"]

# ════════════════════════════════════════════════════════════════
# 쓰기 · 검산
# ════════════════════════════════════════════════════════════════
print("ops_v0.7 — 도급·명령")
wr("contract", src, cols)
wr("contract_eval_item", eval_rows, EVAL_COLS)
wr("order_received", ords, ORD_COLS)

# 옮긴 행 값 불변 — 파일로 다시 읽어 원래 칸을 대조한다
back = rd(OUT, "contract")
assert [r["contract_id"] for r in back] == [r["contract_id"] for r in orig]
for a, b in zip(orig, back):
    for k in V5_COLS:
        assert a[k] == b[k], ("contract", a["contract_id"], k, a[k], b[k])
ob = rd(OUT, "order_received")
for a, b in zip(ord_orig, ob[:17]):
    for k in V6_COLS:
        assert a[k] == b[k], ("order", a["order_id"], k, a[k], b[k])
assert all(r["doc_nature"] for r in ob)
for k in ["entrust_type", "apply_frame", "civil_scope", "civil_basis", "control_result", "control_basis",
          "work_risk", "proc_stage", "order_at"]:
    assert all(r[k] for r in back), k

from collections import Counter
print("\n검산 — 옮긴 행 원래 칸: contract 71×%d · order 17×%d 모두 같음" % (len(V5_COLS), len(V6_COLS)))
for k in ["entrust_type", "apply_frame", "civil_scope", "control_result", "work_risk", "proc_stage"]:
    print("  %-16s %s" % (k, dict(Counter(r[k] for r in back))))
print("  cost_planned 채움 %d건" % sum(1 for r in back if r["cost_planned"]))
print("  doc_nature %s" % dict(Counter(r["doc_nature"] for r in ob)))
print("판 폴더: %s" % OUT)
