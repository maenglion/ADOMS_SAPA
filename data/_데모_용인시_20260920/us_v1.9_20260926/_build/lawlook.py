# -*- coding: utf-8 -*-
"""예시 자료에 인용할 조문을 법령 원문(lawtext 판)에서 확인한다(읽기만).
사용: python lawlook.py DOC-000057 제53조            → 그 조의 조·항·호 원문
      python lawlook.py DOC-000027 --grep 시정명령     → 그 단어가 든 조항호목
"""
import json, os, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lawtext_v1.0_20260924", "doc")


def units(doc):
    d = json.load(open(os.path.join(ROOT, doc + ".json"), encoding="utf-8"))
    return d["title"], d["units"]


if __name__ == "__main__":
    doc = sys.argv[1]
    title, us = units(doc)
    if len(sys.argv) > 3 and sys.argv[2] == "--grep":
        w = sys.argv[3]
        for u in us:
            if w in (u.get("x") or ""):
                print(title, u["l"], "|", u["x"][:220])
    else:
        art = sys.argv[2]
        on = False
        for u in us:
            if u["t"] == "article":
                on = u["l"] == art
            if on:
                print(u["p"], u["l"], "|", u["x"][:400])
