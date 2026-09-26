# -*- coding: utf-8 -*-
"""
정본에서 편입한 의무(ops_v1.2 의 새 줄 8,199)에 이행 유형(T01~T10)을 붙인다 → ops_v1.3_20260924/seed/duty_class.csv (2026-09-24)

왜: 「관계법령 의무이행」(I12·F11·M08)은 단일 의무가 아니라 관계법령 의무 전부를 담는 우산이고,
    그 안은 이행 유형 T01~T10 으로 묶어 보여 준다(사용자 09-24). v1.2 는 새 줄의 이행 유형을 비워 두어
    의무 목록의 유형 칩·묶음에서 새 의무 8,199건이 빠졌다.
어떻게: 앞 판(2,876행)을 만든 규칙 그대로 — `_체크리스트_시설별\\build_yongin_3axis.py` 의 TYPES(조 제목·의무명 낱말),
        예산·비용 낱말은 T01, 어느 규칙에도 안 걸리면 CODE2TYPE(1단 조항의 기능)으로 추론.
        ★ 의무조항(code36)은 바꾸지 않는다 — 새 줄은 우산(관계법령 의무이행)에 그대로 둔다.
          (앞 판의 TYPE2CODE 재배정 — 「기본값」 줄을 유형에 따라 I06·I13·F01·F03 등으로 옮기던 것 — 은 적용하지 않았다.)
        이미 이행 유형이 있는 줄(앞 판 2,876)은 그대로 둔다.
앞 판(ops_v1.2)은 덮어쓰지 않는다.
"""
import collections
import csv
import importlib.util
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
SRC = os.path.join(DEMO, "ops_v1.2_20260924", "seed", "duty_class.csv")
OUT_DIR = os.path.join(DEMO, "ops_v1.3_20260924", "seed")
RULES = os.path.join(os.path.dirname(os.path.dirname(DEMO)), "_체크리스트_시설별", "build_yongin_3axis.py")


# 앞 판 규칙(TYPES)에 안 걸린 새 줄에만 쓰는 보충 낱말 — 산업안전보건법 안전보건규칙처럼 조 제목이 위험·작업 이름인 것이 많아
# 앞 판의 기본 추론(1단 조항 기능 → T05)으로는 「굴착기계등에 의한 위험방지」「탑승의 제한」까지 시설 기준이 된다(09-24 표본 25건 확인).
import re
SUPP = [(c, re.compile(p)) for c, p in [
    ("T08", r"혈액|병원체|건강장해|보건|질병|휴게|스트레스|소음|진동|분진|중량물|근골격|온열|한랭|고열|환기|조명"),
    ("T04", r"조사"),
    ("T09", r"진화|산불|산사태|복귀|구호|피해"),
    ("T02", r"관리자|감독자|임무|직무|전담|종사"),
    ("T06", r"위험방지|방지|제한|조립|해체|체결|탑승|통행|잠금|정지|차단|추락|낙하|붕괴|전도|협착|감전|폭발|화재|용접|"
            r"조치|준수|청소|처리|굴착|양중|크레인|비계|동바리|거푸집|사다리|개구부|배관|구름|제동|신호|관제|폐색|장치|기계|차량|하역|운반|굴|벌목"),
    ("T01", r"대책|수립|관리수준|책무|의무"),
    ("T10", r"명령|요청|편의제공|허가|승인"),
]]


def load_rules():
    sys.path.insert(0, os.path.dirname(os.path.normpath(RULES)))   # duty_master 등 옆 모듈
    spec = importlib.util.spec_from_file_location("y3", os.path.normpath(RULES))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)          # main() 은 __name__ 가드 안이라 돌지 않는다
    return m


def main():
    cur = json.load(io.open(os.path.join(DEMO, "_CURRENT.json"), encoding="utf-8"))
    if os.path.exists(OUT_DIR) and "ops_v1.3_20260924" in cur.get("ops_history", []):
        sys.exit("이미 있다 — 판을 덮어쓰지 않는다: " + OUT_DIR)
    y = load_rules()
    rows = list(csv.DictReader(io.open(SRC, encoding="utf-8-sig")))
    cols = list(rows[0].keys())
    how = collections.Counter()
    for r in rows:
        if r["impl_type"]:
            continue
        title, obl = r["article_title"], r["duty_name"]
        tc, tn, src = y.type_of(title, obl)
        if y.BUDGET.search("%s %s" % (title, obl)):
            tc, src = "T01", "규칙(예산·비용 낱말)"
        if not tc:
            for c, rx in SUPP:
                if rx.search("%s %s" % (title, obl)):
                    tc, src = c, "보충(조 제목 낱말)"
                    break
        if not tc:
            code = r["code36"].split(";")[0].strip()
            tc, src = y.CODE2TYPE.get(code, "T01"), "추론(1단 조항 기능에서)"
        r["impl_type"], r["impl_type_name"] = tc, y.TNAME[tc]
        how[(src.split("(")[0], tc)] += 1
    assert all(r["impl_type"] for r in rows), "이행 유형 빈 줄이 남았다"
    os.makedirs(OUT_DIR, exist_ok=True)   # 등록 전 판만 다시 쓴다(등록된 판은 위에서 막는다)
    with io.open(os.path.join(OUT_DIR, "duty_class.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print("줄", len(rows), "· 새로 붙인 이행 유형", sum(how.values()))
    for (s, t), n in sorted(how.items()):
        print(" ", s, t, y.TNAME[t], n)


if __name__ == "__main__":
    main()
