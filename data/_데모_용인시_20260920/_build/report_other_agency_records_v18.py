# -*- coding: utf-8 -*-
r"""
검토표 — 다른 기관 시설(관리주체 타기관)에 붙은 예시 기록 목록(2026-09-24 · 읽기만).
사용자: 「빼도 될 것 같은데, 다른 기관 시설이 어떤 건지 먼저 보여줘」 → 지우기 전에 사람이 보는 표.
원천: 가장 새 ops_* · us_* 판(앱이 읽는 모양). 출력: 20_개발\…\01_설계\v2_추가화면_20260924\(검토)다른기관시설_예시기록_20260924.html
"""
import csv, glob, html, io, os, collections as C
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(DEMO, "..", "..", "..", ".."))
OUT = os.path.join(ROOT, "20_개발", "_데모_용인시_20260920", "01_설계", "v2_추가화면_20260924", "(검토)다른기관시설_예시기록_20260924.html")
E = html.escape
latest = {}
for pre in ("ops_", "us_"):
    for d in sorted(x for x in os.listdir(DEMO) if x.startswith(pre)):
        for f in glob.glob(os.path.join(DEMO, d, "seed", "*.csv")): latest[(pre, os.path.basename(f)[:-4])] = f
def rd(pre, t):
    with io.open(latest[(pre, t)], encoding="utf-8-sig") as f: return list(csv.DictReader(f))
A = {a["asset_id"]: a for a in rd("ops_", "asset")}
oth = {k: a for k, a in A.items() if a.get("subject_tier") == "타기관"}
dn = {d["dept_id"]: d["dept_name"] for d in rd("ops_", "org_dept")}
KO = {"civil_safety_plan": "안전계획", "civil_manual": "매뉴얼", "hazard_report": "위험 신고", "incident": "재해", "order_received": "명령",
      "contract": "도급", "ceo_activity": "기관장 활동", "drill_plan": "훈련 계획", "usb1_basic": "기본정보(교육자료)", "usb2_timing": "이행 시기(교육자료)",
      "usc_record": "점검 기록(교육자료)", "usd_record": "실적 기록(교육자료)"}
TITLE = ["plan_id", "manual_id", "report_id", "incident_id", "order_id", "contract_id", "activity_id", "drill_id"]
hits = C.defaultdict(list)
for (pre, t), f in latest.items():
    if t not in KO: continue
    for r in rd(pre, t):
        blob = " ".join(str(v) for v in r.values())
        for k in oth:
            if k in blob:
                rid = next((r[c] for c in TITLE if r.get(c)), next(iter(r.values())))
                what = r.get("plan_year") or r.get("title") or r.get("content", "")[:40] or r.get("note", "")[:40]
                hits[k].append((KO[t], rid, what))
rows = sorted(hits.items(), key=lambda kv: (oth[kv[0]]["subject_name"], oth[kv[0]]["asset_gbn"], oth[kv[0]]["asset_name"]))
by_org = C.Counter(oth[k]["subject_name"] or "(이름 없음)" for k, _ in rows)
by_kind = C.Counter(x[0] for _, v in rows for x in v)
tr = []
for k, v in rows:
    a = oth[k]
    kinds = C.Counter(x[0] for x in v)
    tr.append("<tr><td>%s</td><td><b>%s</b><br><small>%s · %s</small></td><td>%s</td><td>%s</td><td>%s</td><td><small>%s</small></td></tr>" % (
        E(a["asset_gbn"]), E(a["asset_name"]), E(a["asset_kind"]), E(a["asset_class"]), E(a["subject_name"] or "-"), E(dn.get(a["dept_id"], a["dept_id"])),
        " · ".join("%s %d" % kv for kv in kinds.most_common()), E(", ".join("%s %s" % (x[1], x[2]) for x in v[:8])) + (" …" if len(v) > 8 else "")))
n = sum(len(v) for _, v in rows)
css = """body{font-family:'Malgun Gothic',sans-serif;margin:0;background:#fff;color:#1d2733;font-size:15px}main{max-width:1300px;margin:0 auto;padding:18px}
h1{font-size:22px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #d5dbe2;padding:6px 8px;vertical-align:top;text-align:left}
th{background:#eef2f6}small{color:#5b6b7c}.box{background:#f5f8fb;border:1px solid #d5dbe2;border-radius:8px;padding:10px 14px;margin:10px 0}"""
body = f"""<main><h1>다른 기관 시설에 붙은 예시 기록 — 지우기 전 검토 (2026-09-24)</h1>
<div class="box">시설 <b>{len(rows)}</b>곳 · 기록 <b>{n}</b>건 — {' · '.join('%s %d' % kv for kv in by_kind.most_common())}<br>
관리기관: {' · '.join('%s %d' % kv for kv in by_org.most_common())}<br>
<small>관리주체 = FMS 공공데이터 관리주체(API) 판정 · 저수지 4곳은 웹 확인(한국농어촌공사). 이 기록들은 시연용 예시 자료이며, 용인시가 관리하지 않는 시설이라 새 데이터 버전에서 빼는 것을 제안한다(앞 버전에는 남는다).
시연 배정은 이미 용인시 시설로 옮겼다(ops_v1.8).</small></div>
<table><thead><tr><th>구분</th><th>시설</th><th>관리기관</th><th>우리 담당 부서(자료상)</th><th>붙은 기록</th><th>기록 번호·내용</th></tr></thead><tbody>{''.join(tr)}</tbody></table></main>"""
io.open(OUT, "w", encoding="utf-8").write(f"<!doctype html><html lang='ko'><head><meta charset='utf-8'><title>다른 기관 시설 예시 기록</title><style>{css}</style></head><body>{body}</body></html>")
print(OUT); print(len(rows), n, dict(by_kind)); print(by_org.most_common(12))
