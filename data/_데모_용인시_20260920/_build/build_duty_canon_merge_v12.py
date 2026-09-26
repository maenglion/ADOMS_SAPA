# -*- coding: utf-8 -*-
"""
정본 발행판 의무를 시연 의무 목록에 편입 → ops_v1.2_20260924/seed/duty_class.csv (2026-09-24)

사용자 지시(09-24): 「정본에만 있고 시연에 없는 의무는 정본 의무를 시연에 반영. 일단 정본 전부를 반영해 놓고,
참고 명세·서울시 사례를 보며 한꺼번에 처리해도 되는 의무를 묶어 단순화하는 방법은 따로 고민.」
+ 「1번(중대재해처벌법 자체 의무 36) · 2번(숫자 체계 통일) · 3번(빠지면 안 되는 법령)」.

무엇을 넣나
  · 정본 발행판 `obl_axes` 의무 판정 obligation 가운데
    - 중대재해처벌법 · 산업안전보건법 · 비교 문서 「해당」 16법 · 이미 시연에 있는 법령 → 의무 전부
    - 「해당 가능」 법령 → 관리주체 성격 의무만(수범자격 사업주·관리주체 · 경영책임자 · 안전관리자)
    - 「해당 없음」 42법(업종·시설 없음) · 「해당 약함」(해양환경·항만·주택·학교보건 등) → 뺀다
  · 이미 시연에 있는 의무는 넣지 않는다 — obl_id 가 같거나, 같은 조항호목(unit_id)을 시연이 이미 읽은 경우.
어떻게 칸을 채우나(정본 값 그대로 · 추정 최소)
  · 재해 구분: 정본 `law_relation_type` — 중대산업재해 → I · 공중이용시설(·공중교통수단) → F · 원료·제조물 → M ·
    「중대산업재해+중대시민재해(공중교통수단)」 → I 와 F 두 줄(시연의 「의무 × 재해 구분」 규칙과 같게) ·
    공통·관계법령 의무이행(제4호) → 보호 대상(protection_target) worker → I · user_public → F · both → I·F 두 줄.
  · 의무조항 36: 중대재해처벌법 자체 36건은 조문대로 정확히(I01~I14 · F01~F13 · M01~M09).
    나머지는 **기본 자리 「관계법령 의무이행」(I12 · F11 · M08)** — 36 분류 품질점검(09-22)에서 낱말 규칙이 틀린 것이 드러나
    세부 조항으로 올리는 일은 따로 한다(assign_basis 에 밝힌다).
  · 관리대상: 이미 시연에 있는 법령은 그 법령·재해 구분에서 가장 많이 쓴 관리대상, 없으면 법령별 표(아래), 그래도 없으면
    중대산업재해 = TG26 사업장·종사자 · 그 밖 = TG24 기관 전체.
  · 용인 표시: 중대재해처벌법 자체 36건 = Y · 나머지 = 조건부(시설·작업 보유를 담당 부서가 확인).
  · review_status = published(정본 발행판) — 검수 전 정독 결과(pending)와 구분된다.
앞 판(ops_v0.3 duty_class.csv)은 덮어쓰지 않는다.
"""
import collections
import csv
import importlib.util
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
DB = os.path.dirname(DEMO)
OUT_DIR = os.path.join(DEMO, "ops_v1.2_20260924", "seed")
csv.field_size_limit(10 ** 9)
sys.path.insert(0, os.path.join(DB, "..", "_체크리스트_시설별"))
from law_family import FAMILY, family_of  # noqa: E402

spec = importlib.util.spec_from_file_location("cmp", os.path.join(DB, "_정본대비_시연의무_20260924", "build_compare_doc.py"))
cmp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cmp)
NONE = cmp.NONE
NEED, MAYBE = cmp.NEED, cmp.MAYBE
# 해당 약함 — 업종·주체가 용인시와 거리가 멀어 뺀다(비교 문서 5·6장 비고 「해당 약함」)
WEAK = {"해양환경관리법", "항만법", "주택법", "주택건설기준 등에 관한 규정", "학교보건법", "비료관리법", "축산물 위생관리법",
        "축산법", "송유관 안전관리법", "석유 및 석유대체연료 사업법", "생활물류서비스산업발전법", "전기사업법"}
# 「해당 가능」 법령에서는 관리주체 성격의 의무만(수범자격 — 사업주·관리주체 · 경영책임자 · 안전관리자)
MANAGER_TYPES = {"business_owner", "chief_officer", "safety_manager"}


def rd(p):
    return list(csv.DictReader(io.open(p, encoding="utf-8-sig")))


SAPA36 = {  # 정본 중대재해처벌법 의무 → 의무조항 36
    "OBL-0000001": "I10", "OBL-0000002": "I11", "OBL-0000003": "I14", "OBL-0000004": "F09", "OBL-0000005": "F10",
    "OBL-0000006": "F13", "OBL-0000007": "M06", "OBL-0000008": "M07", "OBL-0000009": "I01", "OBL-0000010": "I02",
    "OBL-0000011": "I03", "OBL-0000012": "I04", "OBL-0000013": "I05", "OBL-0000014": "I06", "OBL-0000015": "I07",
    "OBL-0000016": "I08", "OBL-0000017": "I09", "OBL-0000018": "I12", "OBL-0000019": "I13", "OBL-0000020": "F01",
    "OBL-0000021": "F02", "OBL-0000022": "F03", "OBL-0000023": "F04", "OBL-0000024": "F05", "OBL-0000025": "F06",
    "OBL-0000026": "F07", "OBL-0000027": "F08", "OBL-0000028": "F11", "OBL-0000029": "F12", "OBL-0000030": "M01",
    "OBL-0000031": "M02", "OBL-0000032": "M03", "OBL-0000033": "M04", "OBL-0000034": "M05", "OBL-0000035": "M08",
    "OBL-0000036": "M09",
}
DEFAULT_CODE = {"I": "I12", "F": "F11", "M": "M08"}
LAW_TARGET = {  # 시연에 없던 법령의 관리대상(이름 기준)
    "산업안전보건법": "TG26", "화재의 예방 및 안전관리에 관한 법률": "TG20", "공공기관의 소방안전관리에 관한 규정": "TG20",
    "소방기본법": "TG20", "소방시설공사업법": "TG20", "석면안전관리법": "TG13", "기계설비법": "TG13", "실내공기질 관리법": "TG13",
    "초고층 및 지하연계 복합건축물 재난관리에 관한 특별법": "TG13", "녹색건축물 조성 지원법": "TG13", "위험물안전관리법": "TG19",
    "식품위생법": "TG28", "공연법": "TG10", "박물관 및 미술관 진흥법": "TG10", "소하천정비법": "TG27", "의료법": "TG30",
    "환자안전법": "TG30", "약사법": "TG30", "응급의료에 관한 법률": "TG24", "도시가스사업법": "TG18", "전기사업법": "TG17",
    "전력기술관리법": "TG17", "전기공사업법": "TG17", "철도의 건설 및 철도시설 유지관리에 관한 법률": "TG14",
    "건설폐기물의 재활용촉진에 관한 법률": "TG23", "대기환경보전법": "TG23", "물환경보전법": "TG23", "악취방지법": "TG23",
    "공중위생관리법": "TG22", "가축전염병 예방법": "TG22", "검역법": "TG22", "산림보호법": "TG12", "산림재난방지법": "TG12",
    "자연공원법": "TG12", "수목원ㆍ정원의 조성 및 진흥에 관한 법률": "TG12", "산림복지 진흥에 관한 법률": "TG12",
    "사방사업법": "TG05", "댐건설ㆍ관리 및 주변지역지원 등에 관한 법률": "TG04", "주차장법": "TG15",
}
LAYER = {"act": "법률", "presidential_decree": "대통령령(시행령)", "ministerial_ordinance": "부령(시행규칙)",
         "notice": "고시", "established_rule": "훈령", "directive": "예규", "admin_regulation": "고시", "institutional_guideline": "고시"}
NAME36 = None


def main():
    global NAME36
    if os.path.exists(OUT_DIR):
        sys.exit("이미 있다 — 판을 덮어쓰지 않는다: " + OUT_DIR)
    B = os.path.join(DB, "build")
    law = {r["law_id"]: r for r in rd(os.path.join(B, "law_20260901_v2.1.csv"))}
    doc = {r["doc_id"]: r for r in rd(os.path.join(B, "doc_20260901_v2.1.csv"))}
    om = {r["obl_id"]: r for r in rd(os.path.join(B, "obl_master_20260811_v2.0.csv"))}
    ax = [a for a in rd(os.path.join(B, "obl_axes_20260811_v2.0.csv")) if a["duty_verdict"] == "obligation"]
    need_units = {a["anchor_unit_id"] for a in ax}
    unit = {}
    for u in csv.DictReader(io.open(os.path.join(B, "unit_20260901_v2.1.csv"), encoding="utf-8-sig")):
        if u["unit_id"] in need_units:
            unit[u["unit_id"]] = u
    ur = {}
    for r in csv.DictReader(io.open(os.path.join(B, "unit_role_20260811_v2.0.csv"), encoding="utf-8-sig")):
        if r["unit_id"] in need_units:
            ur.setdefault(r["unit_id"], r)
    dc = rd(os.path.join(DEMO, "ops_v0.3_20260921", "seed", "duty_class.csv"))
    cols = list(dc[0].keys())
    have_obl = {x["obl_id"] for x in dc if x["obl_id"]}
    have_unit = {x["unit_id"] for x in dc if x["unit_id"]}
    demo_laws = {x["law"] for x in dc}
    NAME36 = {x["code36"]: x["code36_name"] for x in dc if x["code36"] and ";" not in x["code36"]}
    tg_name = {x["target_code"]: x["target_name"] for x in dc}
    tg_mode = collections.defaultdict(collections.Counter)
    for x in dc:
        tg_mode[(x["law"], x["area"])][x["target_code"]] += 1
    # 의무조항 36 이름(시연에 없던 코드 — I02 등)
    import json
    ts = io.open(os.path.join(DB, "..", "..", "..", "20_개발", "_데모_용인시_20260920", "04_앱", "adoms2_v2", "lib", "duty36.ts"), encoding="utf-8").read()
    for d in json.loads(re.search(r"DUTY36: Duty36\[\] = (\[.*?\]);", ts, re.S).group(1)):
        NAME36.setdefault(d["code"], d["name"])

    def areas(a):
        t = a["law_relation_type"]
        if a["obl_id"] in SAPA36:
            return [SAPA36[a["obl_id"]][0]]
        if t in ("중대산업재해", "중대산업재해(핵심)"):
            return ["I"]
        if t.startswith("중대시민재해-원료"):
            return ["M"]
        if t.startswith("중대시민재해-공중이용"):
            return ["F"]
        if t == "중대산업재해+중대시민재해(공중교통수단)":
            return ["I", "F"]
        p = a["protection_target"]
        return ["I"] if p == "worker" else ["F"] if p == "user_public" else ["I", "F"]

    n0 = len(dc)
    add, skipped = [], collections.Counter()
    seq = 1 + max(int(x["duty_key"].split("-")[1]) for x in dc)
    for a in ax:
        L = law.get(a["law_id"], {})
        title = L.get("title_ko", "")
        if title in NONE:
            skipped["해당 없음 법령"] += 1
            continue
        if title in WEAK:
            skipped["해당 약함 법령"] += 1
            continue
        in_demo = title in demo_laws
        if title in MAYBE and not in_demo and ur.get(a["anchor_unit_id"], {}).get("duty_subject_type", "") not in MANAGER_TYPES:
            skipped["해당 가능 법령 — 관리주체 아닌 의무"] += 1
            continue
        if a["obl_id"] in have_obl:
            skipped["이미 시연(같은 의무)"] += 1
            continue
        if a["anchor_unit_id"] in have_unit:
            skipped["이미 시연(같은 조항호목)"] += 1
            continue
        o = om.get(a["obl_id"], {})
        u = unit.get(a["anchor_unit_id"], {})
        d = doc.get(a["doc_id"], {})
        r_ = ur.get(a["anchor_unit_id"], {})
        fam = family_of(L.get("abbr_ko", ""), title)
        for ar in areas(a):
            code = SAPA36.get(a["obl_id"]) or DEFAULT_CODE[ar]
            tgc = (tg_mode.get((title, ar)) or collections.Counter()).most_common(1)
            tg = tgc[0][0] if tgc else LAW_TARGET.get(title) or ("TG26" if ar == "I" else "TG24")
            row = {c: "" for c in cols}
            row.update({
                "duty_key": "DTY-%05d" % seq, "yongin_mark": "Y" if a["obl_id"] in SAPA36 else "조건부", "area": ar,
                "code36": code, "code36_name": NAME36.get(code, ""), "task_name": f"{d.get('title_ko', '')} {a['unit_label']}".strip(),
                "target_code": tg, "target_name": tg_name.get(tg, ""), "impl_type": "", "impl_type_name": "",
                "law_group": fam, "law_group_name": FAMILY.get(fam, ""), "law": title, "doc": d.get("title_ko", ""),
                "layer": LAYER.get(d.get("norm_form", ""), d.get("norm_form", "")), "unit_label_ko": a["unit_label"],
                "article_title": u.get("article_title", ""), "duty_name": o.get("title_ko", "") or u.get("article_title", ""),
                "verdict": "obligation", "duty_subject": r_.get("duty_subject_raw", ""), "cycle_text": o.get("cycle", ""),
                "assign_basis": ("정본 발행판 편입(09-24) — 중대재해처벌법 조문대로" if a["obl_id"] in SAPA36
                                 else "정본 발행판 편입(09-24) — 기본 자리(관계법령 의무이행), 세부 조항 배정 전"),
                "evidence_kind": o.get("evidence_required", ""), "badge": "", "why": "",
                "source_text": (a.get("own_text") or u.get("unit_text") or "")[:2000],
                "law_id": a["law_id"], "doc_id": a["doc_id"], "unit_id": a["anchor_unit_id"], "schedule_id": "",
                "obl_id": a["obl_id"], "review_status": "published",
            })
            add.append(row)
            seq += 1
    os.makedirs(OUT_DIR)
    with io.open(os.path.join(OUT_DIR, "duty_class.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(dc + add)
    ca = collections.Counter(r["area"] for r in add)
    cl = collections.Counter(r["law"] for r in add).most_common(12)
    print(f"시연 {n0} + 편입 {len(add)} = {n0 + len(add)}행 · 재해 구분 {dict(ca)} · 건너뜀 {dict(skipped)}")
    print("많이 들어간 법령:", " · ".join(f"{k} {v}" for k, v in cl))
    print("중대재해처벌법 자체:", sum(1 for r in add if r["obl_id"] in SAPA36))


if __name__ == "__main__":
    main()
