# -*- coding: utf-8 -*-
"""
ops_v0.7 — training_course.csv (교육 과정) : v0.6 11행 보존 + 재해 구분(area) 칸 + 과정 2개 추가.  (2026-09-21)

재해 구분(area)
  I = 중대산업재해      시행령 제5조제2항제3호·제4호(반기 1회 이상)
  F = 중대시민재해 시설·교통  시행령 제11조제2항제3호·제4호(연 1회 이상)
      대상: 공중이용시설의 안전을 관리하는 자 · 공중교통수단의 시설 및 설비를 정비·점검하는 종사자
  M = 중대시민재해 원료·제조물 시행령 제9조제2항제3호·제4호(반기 1회 이상)
  (법령DB DOC-000005 a5/p2 · a9/p2 · a11/p2 원문 대조)

추가 과정(법령DB 원문 대조)
  TC12 철도안전교육 — 철도안전법 제24조제1항(DOC-000061 a24/p1) · 시행규칙 제41조의2제1항제2호·제2항(DOC-000063 a41g2)
       대상에 시행령 제3조제7호 「철도차량 및 철도시설의 점검ㆍ정비 업무에 종사하는 사람」(DOC-000062 a3/n7) 포함
       「매 분기마다 6시간 이상」(a41g2/p2)
  TC13 유해화학물질 안전교육 — 화학물질관리법 제33조제1항(DOC-000009 a33/p1) · 시행규칙 제37조제1항 · 별표 6의3(DOC-000011)
       「매 2년마다 16시간」(관리자 가목·취급 담당자 나목 등은 8시간)

어느 부서에 적용되는지(applies_depts)는 v0.6 과 같이 예시다.
v0.6 판은 건드리지 않고 v0.7 판 폴더에 새로 쓴다.
"""
import csv
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "ops_v0.6_20260921", "seed", "training_course.csv")
OUT_DIR = os.path.join(ROOT, "ops_v0.7_20260921", "seed")
OUT = os.path.join(OUT_DIR, "training_course.csv")

AREA = {
    "TC01": "I", "TC02": "I", "TC03": "I", "TC04": "I", "TC05": "I", "TC06": "I", "TC07": "I", "TC11": "I",
    "TC08": "F",  # 승강기 안전관리자 — 공중이용시설 건물의 승강기
    "TC09": "F",  # 어린이놀이시설 — 공중이용시설 안의 놀이시설일 때만(확인 필요 — note 에 적음)
    "TC10": "F",  # 시설물안전법 정기안전점검 책임기술자 — 제1·2종 시설물(공중이용시설 별표 3)
}
NOTE_ADD = {
    "TC09": "중대재해처벌법 공중이용시설 안의 놀이시설인지 확인 필요",
}

NEW = [
    {
        "course_id": "TC12", "course_name": "철도안전교육 — 경전철 점검·정비 종사자", "law": "철도안전법",
        "basis": "철도안전법 제24조제1항 · 시행규칙 제41조의2제1항제2호·제2항(시행령 제3조제7호 점검·정비 종사자)",
        "target": "철도차량·철도시설의 점검·정비 업무에 종사하는 사람(용인경전철)",
        "cycle": "분기", "cycle_months": "3", "required_hours": "매 분기 6시간 이상(강의·실습)",
        "applies_depts": "D10", "hazardous_work": "N",
        "note": "예시 자료(시연용) · 위탁 운영사 종사자는 계약상 사업주가 실시 — 실시 주체·대상 명단은 운영 위탁 계약으로 확인",
        "area": "F",
    },
    {
        "course_id": "TC13", "course_name": "유해화학물질 안전교육", "law": "화학물질관리법",
        "basis": "화학물질관리법 제33조제1항 · 시행규칙 제37조제1항 · 별표 6의3",
        "target": "유해화학물질 취급시설 기술인력 · 유해화학물질관리자 · 유해화학물질 취급 담당자",
        "cycle": "2년", "cycle_months": "24", "required_hours": "매 2년마다 16시간(대상에 따라 8시간)",
        "applies_depts": "D04", "hazardous_work": "N",
        "note": "예시 자료(시연용) · 정수 약품(염소 등) 취급 예시 — 실제 취급 현황·허가 여부로 확인 필요",
        "area": "M",
    },
]


def main():
    with open(SRC, encoding="utf-8-sig", newline="") as f:
        rd = csv.DictReader(f)
        head = list(rd.fieldnames or [])
        rows = list(rd)
    assert len(rows) == 11, f"v0.6 과정 수가 11이 아님: {len(rows)}"
    assert "area" not in head
    out_head = head + ["area"]
    for r in rows:
        cid = r["course_id"]
        assert cid in AREA, f"재해 구분이 정해지지 않은 과정: {cid}"
        r["area"] = AREA[cid]
        if cid in NOTE_ADD:
            r["note"] = f'{r["note"]} · {NOTE_ADD[cid]}' if r.get("note") else NOTE_ADD[cid]
    ids = {r["course_id"] for r in rows}
    for n in NEW:
        assert n["course_id"] not in ids
        assert set(n) == set(out_head), set(n) ^ set(out_head)
        rows.append(n)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=out_head, lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in out_head})

    # 검사 — v0.6 칸 값이 그대로인지(note 추가분 제외)
    with open(OUT, encoding="utf-8-sig", newline="") as f:
        back = {r["course_id"]: r for r in csv.DictReader(f)}
    with open(SRC, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            b = back[r["course_id"]]
            for k in head:
                if k == "note" and r["course_id"] in NOTE_ADD:
                    assert b[k].startswith(r[k])
                else:
                    assert b[k] == r[k], (r["course_id"], k)
    cnt = {}
    for r in back.values():
        cnt[r["area"]] = cnt.get(r["area"], 0) + 1
    print(f"training_course {len(back)}행 → {OUT}")
    print("재해 구분별:", cnt)


if __name__ == "__main__":
    main()
