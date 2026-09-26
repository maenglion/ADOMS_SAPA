# -*- coding: utf-8 -*-
"""
TG99「미분류(검수)」382건을 법령별로 잠정 분류한다 (2026-09-21 · 사용자 지적).

왜 미분류였나 — 실측
  · 349건은 **새 정독분**(배지 「정본 미반영 — 새 정독(검수 전) · 관리대상 확인 필요」)이다.
    정본에 반영되기 전이라 관리대상 축을 붙이는 분류기가 아직 돌지 않았다.
  · 나머지 33건은 「자산 대장 없음 — 보유 확인 필요」.
  · 법령명 오귀속은 아니었다. 「국토계획법 42건」으로 보인 것은 그 법이 위임한
    국토부 훈령 「공동구 설치 및 관리지침」이었다(화면이 법령명만 크게 보여 생긴 오해).

무엇을 하는가
  문서 이름으로 관리대상을 **잠정** 부여하고 배지에 「관리대상 잠정 — 검수 전」을 남긴다.
  ★ 확정이 아니다. 정본DB 쪽 분류기가 돌면 그 값으로 바뀐다.
  규칙에 걸리지 않는 것은 TG99 로 남겨 둔다 — 억지로 채우지 않는다.
"""
import csv, io, os, collections

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V1 = os.path.join(BASE, "ops_v0.1_20260920", "seed")
OUT = os.path.join(BASE, "ops_v0.3_20260921", "seed")

# 문서·법령 이름에 이 낱말이 있으면 → (코드, 이름)
RULE = [
    ("재난관리자원",           "TG31", "재난관리자원(물자·장비·시설)"),
    ("지방공기업",             "TG32", "지방공기업(공사·공단)"),
    ("공동구",                 "TG33", "공동구"),
    ("중소유통공동도매물류센터", "TG34", "대규모점포·물류센터"),
    ("유통산업발전법",         "TG34", "대규모점포·물류센터"),
    ("하천",                   "TG35", "하천시설(제방·수문·보)"),
    ("정신건강",               "TG30", "의료기관"),
    ("정신질환자",             "TG30", "의료기관"),
    ("소상공인",               "TG34", "대규모점포·물류센터"),
    ("게임산업",               "TG13", "업무시설·복합건축물"),
    ("환경기술",               "TG23", "폐기물·해양오염"),
    ("탄소중립",               "TG24", "기관 전체(모든 시설 공통)"),
    ("전자문서",               "TG24", "기관 전체(모든 시설 공통)"),
    ("중대재해 처벌",          "TG24", "기관 전체(모든 시설 공통)"),
    ("농약",                   "TG28", "식품·급식"),
    ("비료",                   "TG28", "식품·급식"),
    ("약사법",                 "TG19", "유해화학물질·마약류 등 물질"),
    ("국토의 계획",            "TG33", "공동구"),
]

rows = list(csv.DictReader(io.open(os.path.join(V1, "duty_class.csv"), encoding="utf-8-sig")))
cols = list(rows[0].keys())
hit = collections.Counter()
for r in rows:
    if r["target_code"] != "TG99":
        continue
    text = (r.get("doc") or "") + " " + (r.get("law") or "")
    for word, code, name in RULE:
        if word in text:
            r["target_code"] = code
            r["target_name"] = name
            b = r.get("badge") or ""
            r["badge"] = (b + " · " if b else "") + "관리대상 잠정 — 검수 전"
            hit[name] += 1
            break


# ── 배지 문구의 내부 용어 걷어내기 (2026-09-21) ──────────────────
# 화면 글은 다 고쳤는데 **데이터 안에 든 문구**가 남아 그대로 표시됐다.
#   「정본 미반영 — 새 정독(검수 전)」 356건 등. 보는 사람이 알 수 없는 말이다.
BADGE_WORDS = [
    ("정본 미반영 — 새 정독(검수 전)", "법령DB 반영 대기"),
    ("정본 미반영", "법령DB 반영 대기"),
    ("새 정독(검수 전)", "확인 전"),
    ("분류 추론 — 검수 전", "분류 자동 판단 — 확인 전"),
    ("추론 — 검수 전", "자동 판단 — 확인 전"),
    ("관리대상 잠정 — 검수 전", "관리대상 잠정 — 확인 전"),
    ("검수 전", "확인 전"),
    ("정독", "정밀 검토"),
    ("정본", "법령DB"),
]
badge_fixed = 0
for r in rows:
    b = r.get("badge") or ""
    if not b:
        continue
    nb = b
    for a, c in BADGE_WORDS:
        nb = nb.replace(a, c)
    if nb != b:
        r["badge"] = nb
        badge_fixed += 1
print("배지 문구 정리 %d행" % badge_fixed)

left = sum(1 for r in rows if r["target_code"] == "TG99")
os.makedirs(OUT, exist_ok=True)
p = os.path.join(OUT, "duty_class.csv")
with io.open(p, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)

print("TG99 잠정 분류 — 옮긴 것 %d건, 남은 미분류 %d건" % (sum(hit.values()), left))
for k, v in hit.most_common():
    print("  %5d  %s" % (v, k))
print("\n저장: %s" % p)
print("★ 전부 「관리대상 잠정 — 검수 전」 배지를 달았다. 정본 분류기 결과로 바뀐다.")
