# -*- coding: utf-8 -*-
"""
ops_v1.6_20260924 — v2(3300) 발생통계·사고사례 화면용 표 두 개(2026-09-24).
  accident_stat  ← us_v1.0 usg_stat_occur (기관명 일반화 끝난 예시 원장 · 그대로 옮김)
  accident_case  ← us_v1.0 usg_case (사고사례 게시글 · 그대로 옮김)
앞 판(ops_v1.5 · us_v1.0)은 건드리지 않는다. 이미 있으면 멈춘다.
"""
import os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
OUT = os.path.join(DEMO, "ops_v1.6_20260924", "seed")
SRC = os.path.join(DEMO, "us_v1.0_20260924", "seed")
PAIRS = [("usg_stat_occur", "accident_stat"), ("usg_case", "accident_case")]
for _, t in PAIRS:
    if os.path.exists(os.path.join(OUT, t + ".csv")): sys.exit("이미 있다 — 덮어쓰지 않는다: " + t)
os.makedirs(OUT, exist_ok=True)
for s, t in PAIRS:
    shutil.copyfile(os.path.join(SRC, s + ".csv"), os.path.join(OUT, t + ".csv"))
    print(s, "->", t)
