# -*- coding: utf-8 -*-
"""
[400 · 교육자료 버전] 묶음 E(의무이행 — 원료·제조물) 예시 자료 생성기 (2026-09-24)

만드는 표(../seed/):
  use_site.csv    원료·제조물 사업장(수돗물 · 어린이집 급식 · 학교급식 식재료) — 실제 부서 · 관리대상 이름
  use_record.csv  의무이행(실적증빙) 기록 한 곳 — 단계 key · 블록 · 행 데이터(JSON) · 증빙(JSON)
  use_plan.csv    「계획수립 내용 검색 및 추가」 불러오기 원천(안전인력 · 유해·위험요인 · 절차도)

원칙
  · 사람은 직원 명부(staff.csv)의 가상 인물만(staff_id 로도 적어 화면이 명부 이름을 다시 읽는다).
  · 예산 금액은 우리 예산 표(ops_v1.1 safety_budget.csv 의 area=M 줄)에서 계산해 넣는다 — 명세 숫자를 박지 않는다.
  · 관계 법령 의무 행은 우리 의무 목록(ops_v1.3 duty_class.csv)의 duty_key 로만 잇는다.
  · 같은 이름 CSV 를 다시 쓰면 앱 캐시 때문에 안 바뀐다 — 처음부터 완성해서 한 번 쓴다.
"""
import csv, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))           # _데모_용인시_20260920
SEED = os.path.join(HERE, "..", "seed")
YEAR = "2026"
AT = "2026-09-24"


def rd(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


duty = rd("ops_v1.3_20260924/seed/duty_class.csv")
bud = rd("ops_v1.1_20260924/seed/safety_budget.csv")
staff = {r["staff_id"]: r for r in rd("ops_v0.3_20260921/seed/staff.csv")}
# 직원 명부 개명(2026-09-24 사용자 지시) — 명부 파일이 아직 옛 이름이면 여기서 맞춘다
RENAME = {"최미르": "최은정", "윤미르": "윤재석", "오미르": "오현주", "김미르": "김태형",
          "정미르": "정수빈", "장미르": "장혜원", "서미르": "서동욱"}


def nm(sid):
    n = staff[sid]["display_name"]
    for a, b in RENAME.items():
        n = n.replace(a, b)
    return n


SITES = [
    # site_id, 사업장명(원료·제조물), 부서, 관리대상 이름(우리 의무 목록 target_name), 설명
    ("MS01", "수돗물 생산·공급(정수장)", "D04", "상수도(정수장·관로);기관 전체(모든 시설 공통)",
     "상수도사업소 정수장에서 생산해 공급하는 수돗물"),
    ("MS02", "어린이집 급식 식자재", "D07", "식품·급식;기관 전체(모든 시설 공통)",
     "국공립 어린이집 급식에 쓰는 식자재 — 어린이급식관리지원센터 연계"),
    ("MS03", "학교급식 식재료 공급", "D14", "식품·급식;기관 전체(모든 시설 공통)",
     "친환경 학교급식 식재료 공급(농산물 안전성 검사 포함)"),
]
DEPT_NAME = {"D04": "상수도사업소", "D07": "보육정책과", "D14": "농업기술센터"}

recs = []
seq = [0]


def rec(rid, site, step, block, data, files=(), status="", deleted=""):
    seq[0] += 1
    dept = next(s[2] for s in SITES if s[0] == site)
    recs.append({
        "rec_id": rid, "site_id": site, "dept_id": dept, "year": YEAR, "step": step, "block": block,
        "seq": str(seq[0]), "deleted": deleted, "status": status,
        "data": json.dumps(data, ensure_ascii=False),
        "files": json.dumps([dict(name=n, url="", slot=s, at=AT) for n, s in files], ensure_ascii=False),
        "updated_at": AT, "updated_by": "",
    })


# ── 1) 안전인력 확보 ─────────────────────────────────────────────
def person(sid, rank, date, note=""):
    return dict(rank=rank, date=date, staff_id=sid, name=nm(sid), dept=DEPT_NAME[staff[sid]["dept_id"]], note=note)


rec("USE-S0001", "MS01", "staff", "row", person("SD04-1", "안전보건관리책임자", "2026-01-02", "수돗물 수질·정수시설 안전관리 총괄"),
    [("상수도사업소_안전관리_조직도_2026.pdf", "")], "이행완료")
rec("USE-S0002", "MS01", "staff", "row", person("SD04-2", "정수시설운영관리사", "2026-01-02", "수도법 제23조 운영·관리 인력"),
    [("공중이용시설_안전관리_인력현황표_2026.xlsx", "")], "이행완료")
rec("USE-S0003", "MS02", "staff", "row", person("SD07-1", "급식 안전관리 담당", "2026-02-01"), [], "보완필요")
rec("USE-S0004", "MS03", "staff", "row", person("SD14-1", "학교급식 식재료 안전관리 담당", "2026-02-01"), [], "보완필요")

# ── 2) 예산 편성·집행 — 편성액·집행액은 safety_budget(area=M) 에서 계산(천원) ──
KIND2ITEM = {"점검": "안전점검비", "시설": "보수보강비", "교육": "교육·훈련비"}  # 그 밖(인력 등) = 기타
ITEMS = ["안전점검비", "보수보강비", "교육·훈련비", "기타"]


def plan_by_dept(dept):
    out = {k: 0 for k in ITEMS}
    for r in bud:
        if r.get("area") == "M" and r["dept_id"] == dept and r["fiscal_year"] == YEAR:
            out[KIND2ITEM.get(r["budget_kind"], "기타")] += int(r["planned_amount"] or 0) // 1000
    return out


p1 = plan_by_dept("D04")
for i, it in enumerate(ITEMS):
    rec(f"USE-B01{i}", "MS01", "budget", "item", dict(item=it, plan=str(p1[it])))
for i, it in enumerate(ITEMS):   # 다른 사업장은 편성 전(불러오기로 채운다)
    rec(f"USE-B02{i}", "MS02", "budget", "item", dict(item=it, plan="0"))
    rec(f"USE-B03{i}", "MS03", "budget", "item", dict(item=it, plan="0"))

# 집행 내역 — 금액 합이 safety_budget 의 집행액(executed_amount)과 같게 나눈다
EXEC = [
    ("안전점검비", "2026-03-31", "정수·원수 수질검사 위탁(1분기)", 29400, "수질검사_위탁_지출결의서_1분기.pdf"),
    ("안전점검비", "2026-06-30", "정수·원수 수질검사 위탁(2분기)", 29400, "수질검사_위탁_지출결의서_2분기.pdf"),
    ("안전점검비", "2026-08-31", "조류독소 추가 검사", 28800, "조류독소_검사_지출결의서.pdf"),
    ("보수보강비", "2026-04-15", "수질 자동측정기 교체(정수장 3곳)", 198000, "수질자동측정기_교체_준공검사조서.pdf"),
    ("보수보강비", "2026-07-23", "조류 유입 대응 분말활성탄 긴급 투입", 89600, "분말활성탄_구매_지출결의서.pdf"),
    ("교육·훈련비", "2026-05-20", "수도시설 관리자 교육 위탁", 8300, "수도시설관리교육_지출결의서.pdf"),
    ("기타", "2026-06-30", "수질 관리 인력 인건비(상반기)", 81000, "수질관리인력_인건비_집행내역.xlsx"),
]
ex_sum = {k: 0 for k in ITEMS}
for i, (it, d, t, a, f) in enumerate(EXEC):
    ex_sum[it] += a
    rec(f"USE-E01{i}", "MS01", "budget", "exec", dict(item=it, date=d, text=t, amount=str(a), note=""), [(f, "")], "이행완료")
e1 = {k: 0 for k in ITEMS}
for r in bud:
    if r.get("area") == "M" and r["dept_id"] == "D04":
        e1[KIND2ITEM.get(r["budget_kind"], "기타")] += int(r["executed_amount"] or 0) // 1000
assert ex_sum == e1, (ex_sum, e1)   # 집행 내역 합 = 예산 표 집행액

# ── 3) 재해예방업무처리 절차 — 유해·위험요인 확인·점검 표 + 절차도 두 장 ──
rec("USE-P0001", "MS01", "proc", "row", dict(
    hz="원수 조류(남조류) 독소 유입", check="취수원 조류경보(관심) 발령 — 원수·정수 조류독소 검사",
    cdate="2026-07-22", act="분말활성탄 투입 · 정수 조류독소 재검사(불검출)", adate="2026-07-23", note=""),
    [("조류독소_검사성적서_0722.pdf", "")], "이행완료")
rec("USE-P0002", "MS01", "proc", "row", dict(
    hz="관말 잔류염소 부족", check="배수지·관말 잔류염소 측정(기준 미달 2개 지점)",
    cdate="2026-08-12", act="배수지 재염소 주입률 조정 · 재측정", adate="2026-08-13", note=""),
    [("잔류염소_측정기록_0812.xlsx", "")], "이행완료")
rec("USE-P0003", "MS02", "proc", "row", dict(
    hz="여름철 조리 식재료 식중독균 오염", check="보존식 보관 · 조리실 온도 기록 확인",
    cdate="2026-07-10", act="식재료 세척·가열 기준 재안내(어린이집 원장 공문)", adate="2026-07-14", note=""),
    [], "보완필요")
rec("USE-P0004", "MS03", "proc", "row", dict(
    hz="친환경 농산물 잔류농약 기준 초과 우려", check="공급 전 잔류농약 안전성 검사",
    cdate="2026-04-08", act="부적합 품목 공급 중단 · 대체품 공급", adate="2026-04-09", note=""),
    [("잔류농약_안전성검사_결과_0408.pdf", "")], "이행완료")
rec("USE-C0101", "MS01", "proc", "card:report", dict(mode="PDF", wdate="2026-02-10"),
    [("수돗물_유해위험요인_신고개선_절차서_2026.pdf", "pdf")], "이행완료")
rec("USE-C0102", "MS01", "proc", "card:response", dict(mode="PDF", wdate="2026-02-10"),
    [("수질사고_대응절차서_2026.pdf", "pdf")], "이행완료")

# ── ② 재발방지대책 — 재해 카드 ────────────────────────────────
rec("USE-R0001", "MS01", "recur", "card", dict(
    name="정수장 응집제 과주입 — 정수 탁도 일시 상승(공급 전 차단)", date="2026-06-18",
    r1date="2026-06-18", r1text="상황보고서 작성 · 상수도사업소장 보고", r1note="",
    r2date="2026-06-25", r2text="약품 주입 자동제어 경보값 조정 · 운영자 교육", r2note=""),
    [("상황보고서_0618.hwp", "f1"), ("재발방지계획서_0625.pdf", "f2")], "이행완료")
rec("USE-N0001", "MS02", "recur", "nil", dict(nil="Y"), [], "해당없음")

# ── ③ 개선·시정 — 우리 행정처분 수령 표(order_received ORD-012)와 같은 내용 ──
rec("USE-O0001", "MS01", "order", "row", dict(
    item="정수시설 운영·관리 개선 명령(여과지 역세척 설비)", org="기후에너지환경부(한강유역환경청)",
    pdate="2026-08-28", text="역세척 펌프 교체 · 운영 매뉴얼 개정(수도법 제64조제4항)",
    dfrom="2026-09-01", dto="2026-09-27", note="조치 중", order_id="ORD-012"),
    [("한강유역환경청_개선명령_공문_0828.pdf", "")], "보완필요")
rec("USE-N0002", "MS02", "order", "nil", dict(nil="Y"), [], "해당없음")
rec("USE-N0003", "MS03", "order", "nil", dict(nil="Y"), [], "해당없음")

# ── ④ 관계 법령 의무이행 — 우리 의무 목록(duty_class, area=M) duty_key 로 잇는다 ──
DK = {r["duty_key"]: r for r in duty}
first = lambda c: str(c or "").split(";")[0].strip()


def need(k, code):
    assert k in DK and DK[k]["area"] == "M" and first(DK[k]["code36"]) == code, k
    return k


rec("USE-L0001", "MS01", "law", f"duty:{need('DTY-02050', 'M08')}",
    dict(duty_key="DTY-02050", status="이행완료", date="2026-06-30", note="상반기 수질검사"),
    [("먹는물공동시설_수질검사_결과_상반기.pdf", "")], "이행완료")
rec("USE-L0002", "MS01", "law", f"duty:{need('DTY-02060', 'M08')}",
    dict(duty_key="DTY-02060", status="이행완료", date="2026-05-14", note="관세척 구간 3.2km"),
    [("관세척_시행_결과보고.pdf", "")], "이행완료")
rec("USE-L0003", "MS01", "law", f"duty:{need('DTY-02059', 'M08')}",
    dict(duty_key="DTY-02059", status="보완필요", date="", note="수탁자 지도·감독 기록 보완"), [], "보완필요")
# 조건부 의무 하나를 불러와 둔 모양(「계획수립 내용 검색 및 추가」로 더한 행)
cond = next(r for r in duty if r["area"] == "M" and first(r["code36"]) == "M08" and r["yongin_mark"] == "조건부"
            and r["law"] == "수도법" and r["target_name"].startswith("상수도"))
rec("USE-L0004", "MS01", "law", f"duty:{cond['duty_key']}",
    dict(duty_key=cond["duty_key"], pinned="Y", status="미이행", date="", note=""), [], "미이행")
rec("USE-L0005", "MS02", "law", f"duty:{need('DTY-02062', 'M08')}",
    dict(duty_key="DTY-02062", status="이행완료", date="2026-08-29", note="식재료 검수일지 확인"),
    [("급식_식재료_검수일지_8월.pdf", "")], "이행완료")

# 법정교육 — M09
edu = next(r for r in duty if r["area"] == "M" and first(r["code36"]) == "M09" and r["law"] == "수도법"
           and r["unit_label_ko"] == "제52조제2항")
rec("USE-T0001", "MS01", "law", f"edu:{edu['duty_key']}", dict(
    duty_key=edu["duty_key"], edu_name="수도시설 관리 교육", target="정수시설운영관리사 윤재석 외 3명",
    org="한국상하수도협회", date="2026-05-20", note=""),
    [("교육이수자_명부_수도시설관리교육.xlsx", "roster"), ("수도시설관리교육_수료증.pdf", "")], "이행완료")

# ── 불러오기 원천(계획) ───────────────────────────────────────
plans = []


def plan(pid, site, step, block, data):
    plans.append({"plan_id": pid, "site_id": site, "step": step, "block": block,
                  "data": json.dumps(data, ensure_ascii=False)})


for i, (site, sid, rank, tel) in enumerate([
    ("MS01", "SD04-1", "안전보건관리책임자", "내선 4101"),
    ("MS01", "SD04-2", "정수시설운영관리사", "내선 4102"),
    ("MS01", "SM02-2", "수질 안전점검 지원", "내선 2203"),
    ("MS02", "SD07-1", "급식 안전관리 담당", "내선 3701"),
    ("MS02", "SD07-2", "어린이집 위생점검 지원", "내선 3702"),
    ("MS03", "SD14-1", "학교급식 식재료 안전관리 담당", "내선 5401"),
    ("MS03", "SD14-2", "농산물 안전성 검사 담당", "내선 5402"),
]):
    plan(f"UPL-S{i+1:03d}", site, "staff", "row",
         dict(rank=rank, staff_id=sid, name=nm(sid), dept=DEPT_NAME.get(staff[sid]["dept_id"], "안전총괄과"), tel=tel))

for i, (site, hz, chk) in enumerate([
    ("MS01", "원수 조류(남조류) 독소 유입", "취수원 조류경보 발령 여부 · 조류독소 검사"),
    ("MS01", "관말 잔류염소 부족", "배수지·관말 잔류염소 주 1회 측정"),
    ("MS01", "관 세척 후 탁수 공급", "관세척 구간 탁도 측정"),
    ("MS02", "여름철 조리 식재료 식중독균 오염", "보존식 보관 · 조리실 온도 기록 확인"),
    ("MS02", "알레르기 유발 식품 표시 누락", "식단표 알레르기 유발 식품 표시 확인"),
    ("MS03", "친환경 농산물 잔류농약 기준 초과 우려", "공급 전 잔류농약 안전성 검사"),
]):
    plan(f"UPL-H{i+1:03d}", site, "proc", "row", dict(hz=hz, check=chk))

for i, (site, card, title, d, f) in enumerate([
    ("MS01", "report", "수돗물 유해·위험요인 신고 및 개선 절차서", "2026-02-10", "수돗물_유해위험요인_신고개선_절차서_2026.pdf"),
    ("MS01", "response", "수돗물 수질사고 대응 절차서", "2026-02-10", "수질사고_대응절차서_2026.pdf"),
    ("MS02", "report", "어린이집 급식 위해요인 신고 및 개선 절차", "2026-03-05", "어린이집급식_위해요인_신고개선_절차.pdf"),
    ("MS02", "response", "어린이집 식중독 발생시 대응 절차", "2026-03-05", "어린이집_식중독_대응절차.pdf"),
    ("MS03", "report", "학교급식 식재료 부적합 신고 및 개선 절차", "2026-02-20", "학교급식식재료_부적합_신고개선_절차.pdf"),
    ("MS03", "response", "학교급식 식재료 사고 대응 절차", "2026-02-20", "학교급식식재료_사고대응_절차.pdf"),
]):
    plan(f"UPL-C{i+1:03d}", site, "proc", f"card:{card}", dict(title=title, wdate=d, file=f))

# ── 쓰기 ─────────────────────────────────────────────────────
os.makedirs(SEED, exist_ok=True)


def wr(name, rows, cols):
    p = os.path.join(SEED, name)
    assert not os.path.exists(p), f"이미 있다(캐시 때문에 덮어쓰지 않는다): {p}"
    with open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(name, len(rows))


wr("use_site.csv", [dict(site_id=a, site_name=b, dept_id=c, targets=d, note=e) for a, b, c, d, e in SITES],
   ["site_id", "site_name", "dept_id", "targets", "note"])
wr("use_record.csv", recs, ["rec_id", "site_id", "dept_id", "year", "step", "block", "seq", "deleted", "status",
                            "data", "files", "updated_at", "updated_by"])
wr("use_plan.csv", plans, ["plan_id", "site_id", "step", "block", "data"])
