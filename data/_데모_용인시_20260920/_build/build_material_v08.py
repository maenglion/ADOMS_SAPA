# -*- coding: utf-8 -*-
"""
원료·제조물 대장(material_item) — 예시 자료 · ops_v0.8 (2026-09-22)

뼈대: 중대재해처벌법 법 제9조제1항 · 시행령 제8조 · 별표 5
  원문 대조: build/unit_20260901_v2.1_before_20260920u.csv
    DOC-000004 a9/p1  「…사업장에서 생산ㆍ제조ㆍ판매ㆍ유통 중인 원료나 제조물의 설계, 제조, 관리상의 결함…」
    DOC-000005 a8/n3  「별표 5에서 정하는 원료 또는 제조물로 인한 중대시민재해를 예방하기 위해…」
    DOC-000005 a8/n4  업무처리절차(소상공인 제외) · a8/n5 제1호·제2호 반기 점검
  별표 5: build/schedule_20260901_v2.1.csv DOC-000005 b5 (12개 호, 2025.8.5 개정) — 앱 lib/material.ts BYEOLPYO5 와 같다.
  행위 판정표: 기능설계서 ch04 §6 · 환경부 해설서(2023.12) 20·108·116·131·135쪽
    (노트: 40_지침_문서/분석_검토/_참고자료추출_20260921/(노트)환경부_중처법해설서_원료제조물.md)

원칙
  · 후보 4개(수돗물 · 직영 급식 · 예방접종·의약품 · 부산물비료)는 모두 판단 「확인 필요」.
    수돗물·급식을 「해당」으로 정하지 않는다 — 해설서가 판단하지 않은 것이라 사람이 정한다.
  · 별표 5 칸도 비워 둔다(확인 필요) — 후보 호는 사유 문장에만 적는다.
  · 판단 예시는 명백한 1건만 — 청사 소독제·세정제를 사서 쓰기만 함 = 최종 사용 → 비해당(해설서 20·131쪽).
    경영책임자 확인은 비워 둔다(확인 대기로 보이게).
  · 공원 관리용 비료·농약은 행위가 「최종 사용」이라 제안은 비해당 후보지만, 해설서 135쪽이 사용하는 쪽을
    넣지도 빼지도 않았으므로 판단은 「확인 필요」(제안 ≠ 판단을 보이는 줄).

칸
  acts       행위 — produce(생산·제조·판매·유통) · process(공정 투입) · enduse(최종 사용) · provide(제3자 제공·투여·배부), 「;」로 여럿
  byeolpyo5  별표 5 — 호 번호(여럿이면 「;」) · N(별표 5 아님) · 빈칸(확인 필요)
  verdict    판단 — 해당 · 비해당 · 확인 필요 (사람이 정한다)

사용: python _build/build_material_v08.py
  판 폴더에 material_item.csv 가 있으면 멈춘다(판 덮어쓰기 금지).
  _build/ops_v08_add.sql 에 material_item 부분이 없으면 끝에 덧붙인다(파일이 없으면 만든다).
"""
import csv, io, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "ops_v0.8_20260922", "seed")
SQL = os.path.join(BASE, "_build", "ops_v08_add.sql")
EX = "예시 자료(시연용)"

COLS = [
    "item_id", "item_name", "dept_id", "owner_staff_id", "acts", "byeolpyo5", "related_law",
    "verdict", "reason", "basis_ref", "judged_by", "judged_at",
    "ceo_confirmed_at", "ceo_confirmed_by", "ceo_proxy", "updated_at", "created_by", "note",
]

ROWS = [
    dict(item_id="MAT-001", item_name="수돗물(지방상수도 정수·급수)", dept_id="D04", owner_staff_id="SD04-1",
         acts="produce", byeolpyo5="", related_law="수도법 · 먹는물관리법", verdict="확인 필요",
         reason="상수도사업소가 정수해 주민에게 공급한다. 수돗물을 원료·제조물로 보는지 환경부 해설서는 판단하지 않았다"
                "(수도법은 관계 법령 예시로만 실림, 95~96쪽). 정수장·배수지는 공중이용시설 쪽에서 빠지는 경우가 있어 "
                "두 쪽 모두에서 빠진 채 남지 않았는지 함께 본다. 별표 5 해당 여부도 확인 필요.",
         basis_ref="ADOMS 해석(확인 필요) — 해설서 95~96쪽(수도법 관계 법령 예시)",
         created_by="SD01-1", updated_at="2026-09-22", note=EX),
    dict(item_id="MAT-002", item_name="직영 급식(집단급식소 조리·제공)", dept_id="D01", owner_staff_id="",
         acts="", byeolpyo5="", related_law="식품위생법(집단급식소)", verdict="확인 필요",
         reason="시가 직접 운영하는 급식(구내식당 등)이 있는지부터 확인한다. 운영 부서가 정해지기 전이라 총괄 부서가 맡아 둔다. "
                "해설서는 지자체 급식을 판단하지 않았다(식품위생법 집단급식소는 관계 법령 예시, 86~87쪽). "
                "식품은 별표 5 제6호 후보.",
         basis_ref="ADOMS 해석(확인 필요) — 해설서 86~87쪽(식품위생법 관계 법령 예시)",
         created_by="SD01-1", updated_at="2026-09-22", note=EX),
    dict(item_id="MAT-003", item_name="예방접종 백신·의약품(보건소 보관·투여)", dept_id="D11", owner_staff_id="SD11-1",
         acts="provide", byeolpyo5="", related_law="약사법 · 감염병의 예방 및 관리에 관한 법률", verdict="확인 필요",
         reason="보건소가 사서 보관하다 주민에게 투여한다. 해설서 131쪽의 병원 의약품 사례는 「별표 5 의약품 취급 + 관리상 결함」을 "
                "근거로 해당이라고 보았으나, 지자체 보건소 투여를 직접 판단한 문장은 없다. 의약품은 별표 5 제7호 후보.",
         basis_ref="ADOMS 해석(확인 필요) — 해설서 131쪽(병원 의약품 사례)",
         created_by="SD01-1", updated_at="2026-09-22", note=EX),
    dict(item_id="MAT-004", item_name="부산물비료 등 생산·배부(농업기술센터)", dept_id="D14", owner_staff_id="SD14-1",
         acts="", byeolpyo5="", related_law="비료관리법", verdict="확인 필요",
         reason="생산해 농가에 배부하는 비료·미생물 제제가 있는지부터 확인한다. 있으면 생산·배부 행위를 고르고, "
                "부산물비료면 별표 5 제4호 후보.",
         basis_ref="ADOMS 해석(확인 필요) — 해설서 38쪽(별표 5 비료관리법 부산물비료)",
         created_by="SD01-1", updated_at="2026-09-22", note=EX),
    dict(item_id="MAT-005", item_name="청사 소독제·세정제(사서 청사 안에서 사용)", dept_id="D09", owner_staff_id="SD09-1",
         acts="enduse", byeolpyo5="", related_law="", verdict="비해당",
         reason="업체에서 사서 청사 청소·방역에 쓰기만 한다. 생산·제조·판매·유통하지 않고 주민에게 건네지도 않는다 — "
                "최종 사용자의 구입·사용이다.",
         basis_ref="환경부 해설서 20·131쪽(디퓨저를 사서 사무실에서 쓴 회사는 적용 대상 아님)",
         judged_by="SD09-1", judged_at="2026-09-18",
         created_by="SD09-1", updated_at="2026-09-18", note=EX),
    dict(item_id="MAT-006", item_name="공원 관리용 비료·농약(사서 공원에 사용)", dept_id="D06", owner_staff_id="SD06-1",
         acts="enduse", byeolpyo5="", related_law="농약관리법 · 비료관리법", verdict="확인 필요",
         reason="사서 공원에 뿌리기만 하면 최종 사용으로 볼 수 있다. 그러나 해설서 135쪽 질의(공원 관리용 비료·농약)에는 "
                "적용 대상이 「생산·제조·판매·유통 과정의 사업자」라고만 답했고, 사용하는 쪽을 넣지도 빼지도 않았다. "
                "시민이 닿는 곳에 쓰므로 사람이 정한다.",
         basis_ref="환경부 해설서 135쪽 · ADOMS 해석(확인 필요)",
         created_by="SD01-1", updated_at="2026-09-22", note=EX),
]

DDL = """
-- ════════════════════════════════════════════════════════════════════
-- material_item — 원료·제조물 대장 (시행령 제8조 · 제9조 해당 여부 판단) · 2026-09-22
--   생성기: _build/build_material_v08.py · 시드: ops_v0.8_20260922/seed/material_item.csv
--   근거: 법 제9조제1항(생산ㆍ제조ㆍ판매ㆍ유통) · 시행령 제8조제3호·별표 5(12개 호) · 환경부 해설서 20·108·131쪽
--   판단(verdict)은 사람이 정한다. 행위에서 나오는 제안은 저장하지 않는다(앱 lib/material.ts 가 매번 계산).
-- ════════════════════════════════════════════════════════════════════
set search_path to adoms2, public;

create table if not exists material_item (
  item_id          text primary key,   -- 품목 번호(MAT-…)
  item_name        text,               -- 품목
  dept_id          text,               -- 담당 부서
  owner_staff_id   text,               -- 담당자(제8조제1호 인력 판정에 씀)
  acts             text,               -- 행위: produce·process·enduse·provide 를 「;」로
  byeolpyo5        text,               -- 별표 5: 호 번호(「;」로 여럿) · N(아님) · 빈칸(확인 필요)
  related_law      text,               -- 관계 법령
  verdict          text,               -- 판단: 해당 · 비해당 · 확인 필요
  reason           text,               -- 사유(필수)
  basis_ref        text,               -- 근거(해설서 쪽 또는 「ADOMS 해석(확인 필요)」)
  judged_by        text,               -- 판단자
  judged_at        date,               -- 판단일
  ceo_confirmed_at date,               -- 경영책임자 확인일
  ceo_confirmed_by text,               -- 확인한 사람
  ceo_proxy        text,               -- 총괄이 대신 적은 확인 Y
  updated_at       date,               -- 고친 날
  created_by       text,               -- 올린 사람
  note             text                -- 비고
);
"""


def main():
    p = os.path.join(OUT, "material_item.csv")
    if os.path.exists(p):
        sys.exit("멈춤: %s 가 이미 있다(판 덮어쓰기 금지)" % p)
    os.makedirs(OUT, exist_ok=True)
    # 검사 — 사유 필수 · 후보 4개는 확인 필요 · 판단 예시는 근거·판단자가 있어야 한다
    for r in ROWS:
        assert set(r) <= set(COLS), set(r) - set(COLS)
        assert r["reason"].strip(), r["item_id"]
        assert r["verdict"] in ("해당", "비해당", "확인 필요"), r["item_id"]
        if r["verdict"] != "확인 필요":
            assert r["basis_ref"] and r.get("judged_by") and r.get("judged_at") and r["acts"], r["item_id"]
    assert all(r["verdict"] == "확인 필요" for r in ROWS[:4]), "후보 4개는 확인 필요로 둔다"
    assert not any(r["verdict"] == "해당" for r in ROWS), "해당 확정은 사람이 한다"
    with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        for r in ROWS:
            w.writerow({c: r.get(c, "") for c in COLS})
    print("썼다:", p, len(ROWS), "행")

    # DDL — 다른 생성기도 같은 파일에 덧붙일 수 있다. material_item 부분이 이미 있으면 건너뛴다.
    old = io.open(SQL, encoding="utf-8").read() if os.path.exists(SQL) else ""
    if "create table if not exists material_item" in old:
        print("DDL: 이미 있다 —", SQL)
    else:
        with io.open(SQL, "a", encoding="utf-8", newline="\n") as f:
            if not old:
                f.write("-- ADOMS 데모 2차 — ops_v0.8 추가분 (2026-09-22)\n"
                        "-- ★ ops_v07_add.sql 다음에 돌린다. 여러 생성기가 표마다 이 파일 끝에 덧붙인다.\n"
                        "-- 모두 if not exists 라 여러 번 돌려도 안전하다. 외래키는 걸지 않는다. 스키마: adoms2\n")
            f.write(DDL)
        print("DDL: 덧붙였다 —", SQL)


if __name__ == "__main__":
    main()
