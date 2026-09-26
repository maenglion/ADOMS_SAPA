# -*- coding: utf-8 -*-
r"""
us_v1.2_20260924 — 교육자료 버전(3400) 전용 표의 옛 부서 이름을 조직 재편(ops_v1.5·v1.6) 이름으로 바꾼다(2026-09-24).
사용자: 「조직도 반영한 것도 다 3400에 반영하라」. 앞 판(us_v1.0 · us_v1.1)은 그대로 둔다. 이미 있으면 멈춘다.
바꾸는 것은 글자(담당자의 소속 칸 · 기관장 메시지 · 공지 문의처 등)뿐 — 번호(dept_id)는 v1.5 에서 이미 맞췄다.
"""
import glob, io, os, sys, csv
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
OUT = os.path.join(DEMO, "us_v1.2_20260924", "seed")
REP = [("교통정책과(경전철·주차장)", "도시철도과(경전철)"), ("도로과(교량·터널)", "도로구조물과"), ("안전총괄과", "안전점검팀"),
       ("중대재해예방과", "중대재해예방팀"), ("하수도과", "하수도사업소"), ("공원녹지과", "푸른공원사업소"),
       ("보육정책과", "아동보육과"), ("재난안전과", "재난대응담당관"), ("도로과", "도로구조물과")]
latest = {}
for d in sorted(x for x in os.listdir(DEMO) if x.startswith("us_") and x < "us_v1.2"):
    for f in glob.glob(os.path.join(DEMO, d, "seed", "*.csv")):
        latest[os.path.basename(f)] = f
if os.path.exists(OUT): sys.exit("이미 있다 — 덮어쓰지 않는다: " + OUT)
os.makedirs(OUT)
log = []
for t, f in sorted(latest.items()):
    s = io.open(f, encoding="utf-8-sig").read()
    n = s
    for a, b in REP:
        c = n.count(a)
        if c:
            # 이미 바뀐 새 이름(도로구조물과 등) 안의 글자는 건드리지 않는다
            n = n.replace(b, "\x00").replace(a, b).replace("\x00", b)
            log.append({"table": t[:-4], "old": a, "new": b, "count": c, "src": os.path.basename(os.path.dirname(os.path.dirname(f)))})
    if n != s:
        io.open(os.path.join(OUT, t), "w", encoding="utf-8-sig", newline="").write(n)
with io.open(os.path.join(os.path.dirname(OUT), "_orgname_log.csv"), "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=["table", "old", "new", "count", "src"]); w.writeheader(); w.writerows(log)
print(len(log), "종류 ·", sum(r["count"] for r in log), "곳 ·", sorted({r["table"] for r in log}))
