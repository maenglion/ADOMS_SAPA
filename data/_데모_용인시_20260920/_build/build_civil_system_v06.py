# -*- coding: utf-8 -*-
"""
① 체계 수립 화면(/system?area=F)용 예시 자료 — ops_v0.6 (2026-09-21)

뼈대: 중대재해처벌법 **시행령 제10조**(공중이용시설·공중교통수단 관련 안전보건관리체계 구축 및 이행)
      제1호~제8호 · **제11조제2항** 제1호~제4호.
  원문 대조: 정본 unit DOC-000005 a10 · a11 (unit_20260901_v2.1_before_20260920u.csv 에서 읽음).
  ★ 원문 확인 결과
    · 제4호 단서 — 시설물안전법 제6조 안전 및 유지관리계획 **또는** 철도안전법 제6조 연차별 시행계획을
      수립·시행하고, 경영책임자등이 그 수립 여부·내용을 **직접 확인하거나 보고받은 경우**에만 안전계획으로 본다.
      → 계획만 있고 확인·보고 기록이 없으면 갈음이 성립하지 않는다(ceo_confirmed=N 으로 일부 남긴다).
    · 제7호 라목 대피훈련 — 공중교통수단 또는 시설물안전법 제7조제1호 제1종시설물.
    · 제7호 단서 — 철도안전법 제7조 비상대응계획을 포함한 철도안전관리체계(경전철).
    · 제8호 — 가목·나목 **두 개뿐**(다목 없음) · 점검 주기 **연 1회**.
    · 제5호 반기 1회 · 제11조제2항제1호·제3호 연 1회.

만드는 표 (모든 행 note 에 「예시 자료」 — 사람은 기존 staff_id 로만)
  · civil_safety_plan — 시설·연도별 안전계획(제4호). 2025·2026년.
      대상 = FMS 자산 중 공중이용시설 판정이 「해당」·「검토필요」인 것 + 용인경전철(공중교통수단, 자산 대장 밖).
  · civil_manual      — 업무처리절차·매뉴얼(제7호·제8호) · 반기 점검(제5호) · 교육 이수 점검(제11조) ·
                        대피훈련 기록(제7호 라목).

일부러 남긴 빈 곳
  · 2026년 안전계획 미수립·작성 중 일부 · 관리 부서 미지정 자산(D99)은 미수립
  · 시설물안전법 계획으로 갈음하면서 경영책임자 확인·보고 기록이 없는 시설 일부
  · 자체 안전계획에 가목(인력)·다목(보수·보강) 누락 일부
  · 제8호 나목(위탁 업무 안전 비용 기준) 문서 없음
  · 제11조 교육 이수 점검 — 2026년 것은 아직 없음(2025년 12월에 함)
  · 1종시설물 대피훈련 — 올해 안 한 곳이 있다

사용: python _build/build_civil_system_v06.py [--force]
  판 폴더에 같은 이름의 CSV 가 있으면 멈춘다(판 덮어쓰기 금지). 아직 발행 전 판을 다시 만들 때만 --force.
  같은 판 폴더의 다른 표(incident · order_received · safety_budget · training_record · training_course)는 건드리지 않는다.
"""
import csv, io, os, sys, random

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSET = os.path.join(BASE, "ops_v0.1_20260920", "seed", "asset.csv")
OUT = os.path.join(BASE, "ops_v0.6_20260921", "seed")
EX = "예시 자료(시연용)"
FORCE = "--force" in sys.argv
R = random.Random(20260921)


def rd(p):
    with io.open(p, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def wr(name, rows, cols):
    p = os.path.join(OUT, name + ".csv")
    if os.path.exists(p) and not FORCE:
        sys.exit("멈춤: %s 가 이미 있다(판 덮어쓰기 금지). 발행 전 판이면 --force" % p)
    with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            assert set(r) <= set(cols), (name, set(r) - set(cols))
            w.writerow({c: r.get(c, "") for c in cols})
    print("  %-24s %5d행" % (name + ".csv", len(rows)))
    return len(rows)


def day(y, m1, m2):
    m = R.randint(m1, m2)
    d = R.randint(1, 28)
    return "%d-%02d-%02d" % (y, m, d)


# ── civil_safety_plan (제4호) ─────────────────────────────────────
PLAN_COLS = ["plan_id", "plan_year", "facility_kind", "asset_id", "facility_name", "asset_gbn", "asset_kind",
             "asset_class", "dept_id", "plan_status", "plan_basis", "ceo_confirmed", "confirmed_at",
             "mok_ga", "mok_na", "mok_da", "items_planned", "items_done", "established_at",
             "owner_staff_id", "note"]
FMS_PLAN = "시설물안전법 제6조 안전 및 유지관리계획"
RAIL_PLAN = "철도안전법 제6조 연차별 시행계획"
OWN_PLAN = "자체 안전계획"

assets = [a for a in rd(ASSET) if a["sapa_l2_result"] in ("해당", "검토필요")]
plans = []
for year in (2025, 2026):
    seq = 0
    for a in assets:
        seq += 1
        dept = a["dept_id"]
        row = dict(plan_id="CSP-%d-%04d" % (year, seq), plan_year=str(year), facility_kind="공중이용시설",
                   asset_id=a["asset_id"], facility_name=a["asset_name"], asset_gbn=a["asset_gbn"],
                   asset_kind=a["asset_kind"], asset_class=a["asset_class"], dept_id=dept,
                   owner_staff_id=("SD%s-1" % dept[1:]) if dept != "D99" else "", note=EX)
        x = R.random()
        if dept == "D99":
            row.update(plan_status="미수립", note=EX + " · 관리 부서 미지정")
            plans.append(row); continue
        miss = 0.015 if year == 2025 else 0.035
        draft = 0.0 if year == 2025 else 0.02
        if x < miss:
            row.update(plan_status="미수립"); plans.append(row); continue
        if x < miss + draft:
            row.update(plan_status="작성중", plan_basis=OWN_PLAN, mok_ga="Y", mok_na="Y", mok_da="N",
                       items_planned=str(R.randint(3, 8)), items_done="0")
            plans.append(row); continue
        own_share = 0.45 if a["asset_gbn"] == "건축물" else 0.08
        if R.random() < own_share:
            basis = OWN_PLAN
            ga = "N" if R.random() < 0.12 else "Y"
            na = "N" if R.random() < 0.03 else "Y"
            da = "N" if R.random() < 0.08 else "Y"
            conf, conf_at = "", ""
        else:
            basis = FMS_PLAN
            ga = "N" if R.random() < 0.10 else "Y"
            na, da = "Y", "Y"
            ok = R.random() < (0.93 if year == 2025 else 0.85)
            conf = "Y" if ok else "N"
            conf_at = day(year, 2, 3) if ok else ""
        planned = R.randint(3, 10)
        if year == 2025:
            done = planned if R.random() < 0.9 else planned - R.randint(1, 2)
        else:
            done = int(round(planned * R.uniform(0.35, 0.95)))
        row.update(plan_status="수립", plan_basis=basis, ceo_confirmed=conf, confirmed_at=conf_at,
                   mok_ga=ga, mok_na=na, mok_da=da, items_planned=str(planned), items_done=str(max(0, done)),
                   established_at=day(year, 1, 2))
        plans.append(row)
    # 공중교통수단 — 용인경전철(에버라인). FMS 자산 대장에는 없다.
    plans.append(dict(plan_id="CSP-%d-T001" % year, plan_year=str(year), facility_kind="공중교통수단",
                      asset_id="", facility_name="용인경전철(에버라인)", asset_gbn="경전철", asset_kind="도시철도차량·시설",
                      asset_class="", dept_id="D10", plan_status="수립", plan_basis=RAIL_PLAN, ceo_confirmed="Y",
                      confirmed_at="%d-02-24" % year, mok_ga="Y", mok_na="Y", mok_da="Y",
                      items_planned="12", items_done="12" if year == 2025 else "8",
                      established_at="%d-01-20" % year, owner_staff_id="SD10-1",
                      note=EX + " · 도시철도법 계열(궤도운송법 비적용) · 자산 대장 밖"))

# ── civil_manual (제5·7·8호 · 제11조) ───────────────────────────
MAN_COLS = ["manual_id", "clause_ref", "record_kind", "title", "covers", "missing", "basis", "asset_id",
            "facility_name", "enacted_at", "revised_at", "done_at", "last_check_at", "reported_at",
            "participants", "owner_staff_id", "note"]
man = [
    dict(manual_id="CMN-001", clause_ref="10-7", record_kind="업무처리절차",
         title="공중이용시설 유해·위험요인 확인·점검 및 개선 절차", covers="가·나",
         enacted_at="2022-06-30", revised_at="2025-11-20", last_check_at="2026-06-25", owner_staff_id="SM02-1", note=EX),
    dict(manual_id="CMN-002", clause_ref="10-7", record_kind="매뉴얼",
         title="중대시민재해 발생 시 긴급대응 매뉴얼(공중이용시설)", covers="다",
         enacted_at="2022-06-30", revised_at="2024-12-02", last_check_at="2026-03-18", owner_staff_id="SM02-2",
         note=EX + " · 긴급구호·긴급안전점검·위험표지·신고·원인조사 개선 절 포함"),
    dict(manual_id="CMN-003", clause_ref="10-7", record_kind="매뉴얼",
         title="1종시설물·경전철 비상 대피훈련 운영 계획", covers="라",
         enacted_at="2023-02-14", revised_at="2026-01-30", last_check_at="2026-04-22", owner_staff_id="SD13-1", note=EX),
    dict(manual_id="CMN-004", clause_ref="10-7", record_kind="철도안전관리체계",
         title="용인경전철 철도안전관리체계(비상대응계획 포함)", covers="가·나·다·라", basis="철도안전법 제7조",
         facility_name="용인경전철(에버라인)", enacted_at="2013-04-26", revised_at="2026-02-10",
         last_check_at="2026-03-16", reported_at="2026-03-16", owner_staff_id="SD10-1",
         note=EX + " · 경영책임자 보고 완료(제7호 단서)"),
    dict(manual_id="CMN-005", clause_ref="10-8", record_kind="기준·절차",
         title="공중이용시설 운영·관리 위탁 수탁자 안전관리능력 평가 기준·절차", covers="가", missing="나",
         enacted_at="2023-07-10", revised_at="", last_check_at="2025-12-18", reported_at="2025-12-22",
         owner_staff_id="SM02-3", note=EX + " · 위탁 업무 수행 시 필요한 비용 기준(나목)이 없다"),
    dict(manual_id="CMN-010", clause_ref="10-5", record_kind="반기 점검",
         title="2025년 하반기 중대시민재해 안전보건관리체계 이행 점검(제1~4호)", covers="1·2·3·4",
         done_at="2026-01-15", reported_at="2026-01-20", owner_staff_id="SM02-1", note=EX),
    dict(manual_id="CMN-011", clause_ref="10-5", record_kind="반기 점검",
         title="2026년 상반기 중대시민재해 안전보건관리체계 이행 점검(제1~4호)", covers="1·2·3·4",
         done_at="2026-07-14", reported_at="2026-07-21", owner_staff_id="SM02-1", note=EX),
    dict(manual_id="CMN-020", clause_ref="11-3", record_kind="교육 이수 점검",
         title="2025년 관계법령 법정교육 이수 점검(시설물 안전관리자·경전철 정비 종사자)", covers="",
         done_at="2025-12-05", reported_at="2025-12-12", owner_staff_id="SM02-2",
         note=EX + " · 2026년 점검은 아직 없음"),
]
first = [a for a in assets if a["asset_class"] == "1종"]
n = 0
for a in first:
    x = R.random()
    if x < 0.62:
        when = day(2026, 3, 9)
    elif x < 0.85:
        when = day(2025, 4, 11)
    else:
        continue
    n += 1
    man.append(dict(manual_id="CMN-D%03d" % n, clause_ref="10-7", record_kind="대피훈련",
                    title="%s 비상 대피훈련" % a["asset_name"], covers="라", asset_id=a["asset_id"],
                    facility_name=a["asset_name"], done_at=when, participants=str(R.randint(8, 40)),
                    owner_staff_id="SD%s-1" % a["dept_id"][1:] if a["dept_id"] != "D99" else "", note=EX))
for when, ppl in (("2025-10-15", "64"), ("2026-04-22", "71")):
    n += 1
    man.append(dict(manual_id="CMN-D%03d" % n, clause_ref="10-7", record_kind="대피훈련",
                    title="용인경전철 열차 고장·화재 시 승객 대피훈련", covers="라", facility_name="용인경전철(에버라인)",
                    done_at=when, participants=ppl, owner_staff_id="SD10-1", note=EX))

os.makedirs(OUT, exist_ok=True)
print("쓰는 곳:", OUT)
wr("civil_safety_plan", plans, PLAN_COLS)
wr("civil_manual", man, MAN_COLS)
print("1종시설물(대상 판정 해당·검토필요):", len(first))
