# -*- coding: utf-8 -*-
"""
도급·용역·위탁 계약 금액을 실제 분포에 맞춘다 → ops_v1.0_20260924/seed/contract.csv (2026-09-24)

사용자 지시(09-23~24): 「용인시가 도급·용역·위탁으로 처리하는 예산이 정말 연 888억인가? 건수도 — 현실성 있는 숫자로.」
확인(용인특례시 계약정보공개시스템 공개 API, 계약일 2025-01-01~12-31):
  일반회계 공사 2,412건 2,594억 · 용역 3,395건 3,633억 · 물품 6,033건 1,477억 / 상하수도특별회계 공사 1,096건 · 용역 300건.
  대부분 소액(공사 2천만 미만 41% · 용역 73%) — 점검·검사 용역은 1건 수천만 원 수준(예: 경안천교 정밀안전점검 2,122만).
  생활폐기물 수집·운반 민간대행은 **3년(2026~2028) 권역별 총액** 140억~250억으로 등록된다.
고침: 데모 표본 71건(중점 관리 계약)은 그대로 두고, 실제보다 몇 배 큰 점검·검사·자문 용역 금액과 폐기물 대행 계약 형태만 바꾼다.
      안전보건관리비·산업안전보건관리비 계획(cost_planned·safety_cost)은 금액 비율대로 같이 줄인다.
판 번호: 문자열 정렬에서 「v0.10」이 「v0.9」보다 앞에 오므로(앱은 폴더 이름을 거꾸로 정렬해 새 판을 찾는다) v1.0 으로 올린다.
앞 판(ops_v0.7 contract.csv)은 덮어쓰지 않는다.
"""
import csv
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
SRC = os.path.join(DEMO, "ops_v0.7_20260921", "seed", "contract.csv")
OUT_DIR = os.path.join(DEMO, "ops_v1.0_20260924", "seed")

# 계약 → (새 금액(원), 새 이름 · 시작 · 끝 — 바꿀 때만)
CHANGE = {
    "CTR-0062": (15_450_000_000, "2026~2028년 생활폐기물 수집·운반 민간대행 용역(1권역)", "2026-01-01", "2028-12-31"),
    "CTR-0063": (17_650_000_000, "2026~2028년 생활폐기물 수집·운반 민간대행 용역(2권역)", "2026-01-01", "2028-12-31"),
    "CTR-0059": (390_000_000,), "CTR-0005": (92_000_000,), "CTR-0006": (168_000_000,), "CTR-0031": (58_000_000,),
    "CTR-0052": (36_000_000,), "CTR-0036": (28_000_000,), "CTR-0007": (42_000_000,), "CTR-0055": (18_000_000,),
    "CTR-0048": (22_000_000,), "CTR-0041": (88_000_000,), "CTR-0058": (45_000_000,), "CTR-0061": (39_000_000,),
    "CTR-0057": (68_000_000,), "CTR-0065": (48_000_000,), "CTR-0026": (54_000_000,), "CTR-0060": (64_000_000,),
    "CTR-0066": (120_000_000,), "CTR-0018": (95_000_000,),
}


def main():
    if os.path.exists(OUT_DIR):
        sys.exit("이미 있다 — 판을 덮어쓰지 않는다: " + OUT_DIR)
    rows = list(csv.DictReader(io.open(SRC, encoding="utf-8-sig")))
    cols = list(rows[0].keys())
    before = sum(float(r["amount"] or 0) for r in rows)
    for r in rows:
        c = CHANGE.get(r["contract_id"])
        if not c:
            continue
        old = float(r["amount"] or 0)
        new = c[0]
        ratio = new / old if old else 1
        for k in ("cost_planned", "safety_cost", "cost_settled"):
            if r.get(k):
                r[k] = str(int(round(float(r[k]) * ratio, -3)))
        r["amount"] = str(new)
        if len(c) > 1:
            r["contract_name"], r["start_date"], r["end_date"] = c[1], c[2], c[3]
    after = sum(float(r["amount"] or 0) for r in rows)
    os.makedirs(OUT_DIR)
    with io.open(os.path.join(OUT_DIR, "contract.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print("계약 %d건 · 바꾼 것 %d건 · 합계 %.0f억 → %.0f억" % (len(rows), len(CHANGE), before / 1e8, after / 1e8))


if __name__ == "__main__":
    main()
