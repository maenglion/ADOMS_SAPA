# -*- coding: utf-8 -*-
"""
ops_v1.6_20260924 — 조직도 대조 반영(2026-09-24). 앞 판 ops_v1.5 는 그대로.
근거: 용인시청 누리집 조직도(organizeGuide01~03 · 업무안내) 2026-09-24 조회
      보고서 20_개발\_데모_용인시_20260920\01_설계\v2_추가화면_20260924\(조사)용인시_조직도_대조_20260924.md
  D07 보육정책과 → 아동보육과(제1부시장 › 사회복지국) — 「보육정책」은 팀 이름
  D08 체육진흥과 · D12 자원순환과 — 실제로 있다(앞서 「가상」으로 둔 것을 바로잡음)
  D18 산림과 — 농림축산국은 제1부시장 소속 · D15 경로 보강 · D11 보건소 세 곳 표기
build_decisions_v16.py 가 쓴 org_dept(가상 표시)를 이 결과로 다시 쓴다(내 미등록 산출물). staff 는 부서장 직위만 바꾼다.
"""
import csv, glob, io, os
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
V = os.path.join(DEMO, "ops_v1.6_20260924")
def read(p):
    with io.open(p, encoding="utf-8-sig") as f:
        r = csv.DictReader(f); return list(r.fieldnames), list(r)
def write(p, c, rows):
    with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=c); w.writeheader(); w.writerows(rows)
FIX = {
 "D07": {"dept_name": "아동보육과", "org_path": "제1부시장 › 사회복지국 › 아동보육과(보육정책팀 · 보육지원팀)",
         "duties": "시립어린이집 중대재해처벌법 관련 업무 · 국공립·시립어린이집 위탁·개보수(보육정책팀) · 어린이집 지도점검·안전점검(급식·위생·놀이시설·통학차량 — 보육지원팀)",
         "related_note": "구청 가정복지과(보육지원팀·보육지도팀)가 어린이집 인가·지도를 권역별로 맡는다 — 유관", "web_checked": "Y"},
 "D08": {"org_path": "제1부시장 › 문화체육관광국 › 체육진흥과(체육시설팀 · 체육시설운영팀)",
         "duties": "공공체육시설 확충·유지보수(체육시설팀) · 시설 운영·위탁관리, 체육시설 안전점검 및 중대재해(체육시설운영팀)",
         "related_note": "구청 자치행정과 문화체육팀이 공공체육시설 안전점검을 권역별로 맡는다 — 유관", "web_checked": "Y"},
 "D12": {"org_path": "제2부시장 › 기후환경위생국 › 자원순환과(자원시설운영팀 · 자원시설팀 · 음식물자원팀)",
         "duties": "용인환경센터·수지환경센터 운영, 매립지 사후관리(자원시설운영팀) · 그린에코파크 조성·적환장 개선(자원시설팀) · 용인에코타운 운영(음식물자원팀)",
         "related_note": "", "web_checked": "Y"},
 "D18": {"org_path": "제1부시장 › 농림축산국 › 산림과(산림정책팀 등)"},
 "D15": {"org_path": "제2부시장 › 건설국 › 도로건설과(도로정비팀 등)"},
 "D11": {"org_path": "처인구보건소 › 보건정책과(감염병대응팀 · 보건행정팀) — 기흥구·수지구보건소는 보건행정과"},
}
log = []
p = os.path.join(V, "seed", "org_dept.csv")
_, base = read(sorted(glob.glob(os.path.join(DEMO, "ops_v1.5_20260924", "seed", "org_dept.csv")))[-1])
c, cur = read(p)
old = {o["dept_id"]: o for o in base}
for o in cur:
    for k, v in FIX.get(o["dept_id"], {}).items():
        if o[k] != v: log.append({"table": "org_dept", "key": o["dept_id"], "col": k, "old": old[o["dept_id"]].get(k, ""), "new": v, "why": "조직도 대조(09-24)"}); o[k] = v
    if o["dept_id"] in FIX and o["web_checked"] == "가상": o["web_checked"] = "Y"
write(p, c, cur)
# 부서장 직위
sp = os.path.join(V, "seed", "staff.csv")
if os.path.exists(sp): raise SystemExit("staff 이미 있음 — 확인")
sc, st = read(sorted(glob.glob(os.path.join(DEMO, "ops_v1.5_20260924", "seed", "staff.csv")))[-1])
for s in st:
    if s["staff_id"] == "H07":
        for k in ("display_name", "position"):
            nv = s[k].replace("보육정책과장", "아동보육과장")
            if nv != s[k]: log.append({"table": "staff", "key": "H07", "col": k, "old": s[k], "new": nv, "why": "D07 이름 바로잡음"}); s[k] = nv
write(sp, sc, st)
lp = os.path.join(V, "_decision_log.csv")
_, L = read(lp)
L = [r for r in L if not (r["table"] == "org_dept" and r["why"].startswith("②"))] + log
write(lp, ["table", "key", "col", "old", "new", "why"], L)
print("바뀐 칸", len(log))
