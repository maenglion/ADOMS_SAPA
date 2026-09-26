# -*- coding: utf-8 -*-
"""이행점검 및 조치 화면을 GET 으로만 열어 글자만 남긴다(전·후 비교용). 쓰기 단추는 누르지 않는다.
사용: python snap_pages.py before|after
"""
import sys, re, os, html, urllib.request

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), sys.argv[1] if len(sys.argv) > 1 else "before")
os.makedirs(OUT, exist_ok=True)
BASE = "http://localhost:3400"
PAGES = []
for role in ["gm", "road", "road_head", "ceo"]:
    for t in ["ws", "fc", "mt"]:
        PAGES += [f"/check/{t}?role={role}", f"/check/{t}/review?role={role}"]
        # 경영책임자(ceo)가 총괄표를 열면 활동기록(usf_ceo_log)을 쓰므로 ceo 로는 열지 않는다(쓰기 금지)
        if role != "ceo":
            PAGES += [f"/check/{t}/summary?role={role}"]
    PAGES += [f"/hazards?role={role}", f"/recurrence?role={role}", f"/actions?role={role}"]
PAGES += ["/status?role=gm", "/?role=gm", "/?role=ceo"]


def text_of(h):
    h = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", h)
    h = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h\d|summary|details|table)>", "\n", h)
    h = re.sub(r"(?i)</t[dh]>", " | ", h)
    h = re.sub(r"<[^>]+>", " ", h)
    h = html.unescape(h)
    lines = [re.sub(r"[ \t]+", " ", l).strip() for l in h.split("\n")]
    return "\n".join(l for l in lines if l)


for p in PAGES:
    name = re.sub(r"[^a-z0-9]+", "_", p.strip("/").lower()) or "home"
    name = name.strip("_") or "home"
    try:
        with urllib.request.urlopen(BASE + p, timeout=60) as r:
            t = text_of(r.read().decode("utf8", "replace"))
    except Exception as e:  # noqa
        t = f"ERROR {e}"
    with open(os.path.join(OUT, name + ".txt"), "w", encoding="utf8") as f:
        f.write(p + "\n" + t)
    print(p, len(t))
