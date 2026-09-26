# -*- coding: utf-8 -*-
"""
법정 서식 HTML 다시 만들기 → ops_v0.9_20260923/forms/ (2026-09-23)

사용자 지시(09-23): 「서식 0000604(보험금액, 제27조제3항 관련)가 깨진다 — 세 앱 모두 고쳐 달라.」
원인: 원문이 표의 줄마다 빈 줄을 끼웠는데 변환기(schedule_to_html.py)가 빈 줄을 「표 끝」으로 읽어
      줄마다 표를 하나씩 만들었다(604 는 346개 조각). 이어지는 줄 합치기도 못 해 「수술이 불가피 / 한 상해」로 끊겼다.
고침: schedule_to_html.py — 표 안 빈 줄 무시 · 가로 괘선을 지나면 새 행 · 칸 이어 붙이기 규칙(_join).

세 앱(원본 3100 · 캡처본 3200 · 캡처 v2 3300)은 모두 `lib/forms.ts` 로 **가장 새 ops 판의 forms/** 를 읽는다.
그래서 새 판 하나로 세 앱이 함께 고쳐진다. 앞 판(ops_v0.5 forms)은 덮어쓰지 않는다.

목록(131건)은 ops_v0.5 forms/_index.json 그대로. 원문은 데모 기준 스냅숏 base_R-20260917-02 의 schedule 에서 읽는다.
"""
import csv
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import schedule_to_html as S  # noqa: E402

csv.field_size_limit(10 ** 9)
SRC_INDEX = os.path.join(DEMO, "ops_v0.5_20260921", "forms", "_index.json")
SRC_TEXT = os.path.join(DEMO, "base_R-20260917-02", "01_사실층", "schedule_20260901_v2.1.csv")
OUT = os.path.join(DEMO, "ops_v0.9_20260923", "forms")


def main():
    if os.path.exists(OUT):
        sys.exit("이미 있다 — 판을 덮어쓰지 않는다: " + OUT)
    idx = json.load(io.open(SRC_INDEX, encoding="utf-8"))
    ids = {x["id"] for x in idx}
    text = {}
    for r in csv.DictReader(io.open(SRC_TEXT, encoding="utf-8-sig")):
        if r["schedule_id"] in ids:
            text[r["schedule_id"]] = r["schedule_text"]
    miss = sorted(ids - set(text))
    if miss:
        sys.exit("원문 없음: %s" % miss)
    os.makedirs(OUT)
    old_dir = os.path.dirname(SRC_INDEX)
    report = []
    for x in idx:
        t = text[x["id"]]
        h = S.to_html(t, x["title"])
        io.open(os.path.join(OUT, x["id"] + ".html"), "w", encoding="utf-8").write(h)
        x2 = dict(x, quality=S.quality(t))
        report.append(x2)
        old = io.open(os.path.join(old_dir, x["id"] + ".html"), encoding="utf-8").read()
        x2["_tables"] = (old.count("<table"), h.count("<table"))
        x2["_rows"] = (old.count("<tr>"), h.count("<tr>"))
    io.open(os.path.join(OUT, "_index.json"), "w", encoding="utf-8").write(
        json.dumps([{k: v for k, v in r.items() if not k.startswith("_")} for r in report], ensure_ascii=False, indent=1))
    changed = [r for r in report if r["_tables"][0] != r["_tables"][1] or r["_rows"][0] != r["_rows"][1]]
    print("서식 %d건 · 표/행 수가 바뀐 것 %d건" % (len(report), len(changed)))
    for r in sorted(changed, key=lambda r: -(r["_tables"][0] - r["_tables"][1]))[:25]:
        print("  %s 표 %d→%d · 행 %d→%d  %s" % (r["id"], *r["_tables"], *r["_rows"], r["title"][:30]))


if __name__ == "__main__":
    main()
