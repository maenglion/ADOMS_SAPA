# -*- coding: utf-8 -*-
"""
조직 재편·정합성 검수 보고서(HTML) — ops_v1.5 의 부서·직원·이동 기록·검수 결과에서 만든다(2026-09-24).
출력: 20_개발/_데모_용인시_20260920/01_설계/(보고)조직재편_정합성검수_20260924_v1.0.html
"""
import csv, glob, html, io, json, os, collections as C
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
V15 = os.path.join(DEMO, "ops_v1.5_20260924")
OUT = os.path.normpath(os.path.join(DEMO, "..", "..", "..", "..", "20_개발", "_데모_용인시_20260920", "01_설계", "(보고)조직재편_정합성검수_20260924_v1.0.html"))
E = html.escape
def rd(p):
    with io.open(p, encoding="utf-8-sig") as f: return list(csv.DictReader(f))

org = rd(os.path.join(V15, "seed", "org_dept.csv"))
staff = rd(os.path.join(V15, "seed", "staff.csv"))
log = rd(os.path.join(V15, "_migration_log.csv"))
rep = json.load(io.open(os.path.join(V15, "_integrity_report.json"), encoding="utf-8"))
asg = rd(os.path.join(V15, "seed", "duty_assignment.csv"))
asset = rd(os.path.join(V15, "seed", "asset.csv"))
nA = C.Counter(a["dept_id"] for a in asset); nD = C.Counter(a["dept_id"] for a in asg)

def tbl(head, rows):
    return "<table><thead><tr>" + "".join(f"<th>{E(h)}</th>" for h in head) + "</tr></thead><tbody>" + \
        "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table>"

orows = []
for o in org:
    if o["dept_id"] == "D99": continue
    heads = [s["display_name"] for s in staff if s["dept_id"] == o["dept_id"] and s.get("approval_level") in ("2", "3")]
    doers = [s["display_name"] for s in staff if s["dept_id"] == o["dept_id"] and s.get("approval_level") == "1"]
    new = "<span class='b new'>새 부서</span> " if o["dept_id"] >= "D15" else ""
    chk = "" if o["web_checked"] == "Y" else " <span class='b warn'>소속 확인 필요</span>"
    orows.append([f"{o['dept_id']}", f"{new}<b>{E(o['dept_name'])}</b>{chk}", E(o["dept_role"]), E(o["org_path"]), E(o["duties"]),
                  f"<small>{E(o['related_note'])}</small>", "<br>".join(E(h) for h in heads), E(" · ".join(doers)),
                  f"{nA.get(o['dept_id'], 0):,}", f"{nD.get(o['dept_id'], 0):,}"])

mv = C.Counter((r["old"], r["new"], r["why"]) for r in log if r["table"] == "asset")
dn = {o["dept_id"]: o["dept_name"] for o in org}
mrows = [[E(dn.get(a, a)), E(dn.get(b, b)), f"{n}", E(w)] for (a, b, w), n in mv.most_common()]
ch = C.Counter(r["table"] for r in log)
crows = [[f"<code>{E(t)}</code>", f"{n:,}"] for t, n in ch.most_common()]

def fmt(v):
    if isinstance(v, dict): return "없음" if not v else E("; ".join(f"{k}: {x}" for k, x in v.items()))
    if isinstance(v, list): return "없음" if not v else E(", ".join(v))
    return E(str(v))
keys = [k for k in rep["후"]]
vrows = [[E(k), fmt(rep["전"].get(k, "-")), fmt(rep["후"][k]), ("<span class='b ok'>통과</span>" if (rep["후"][k] in ({}, [], 0)) else "<span class='b warn'>설명</span>")] for k in keys]

css = """
:root{--ink:#1d2733;--mut:#5b6b7c;--line:#d5dbe2;--head:#eef2f6}
@page{size:A4 landscape;margin:10mm}
body{margin:0;background:#fff;color:var(--ink);font-family:'Malgun Gothic','Noto Sans KR',sans-serif;font-size:10.5pt;line-height:1.55}
main{max-width:1500px;margin:0 auto;padding:16px}
h1{font-size:19pt;margin:0 0 4px} h2{font-size:14pt;border-bottom:2px solid #333;padding-bottom:3px;margin-top:22px}
.meta{color:var(--mut);font-size:9.5pt}
table{border-collapse:collapse;width:100%;margin:6px 0 12px;font-size:9.3pt}
th,td{border:1px solid var(--line);padding:4px 6px;vertical-align:top;text-align:left}
th{background:var(--head)} tr{break-inside:avoid}
small{color:var(--mut)} code{color:#1f4e79}
.b{display:inline-block;padding:0 7px;border-radius:9px;font-weight:700;font-size:8.5pt;white-space:nowrap}
.b.ok{background:#e3f3e6;color:#1e7b34}.b.warn{background:#fff3d6;color:#8a6100}.b.new{background:#e4ecfb;color:#1f4e9c}
ul{margin:4px 0 8px}
"""
body = f"""<main>
<h1>조직 재편 · 데이터 정합성 검수 보고 (2026-09-24)</h1>
<p class="meta">근거: 용인시청 누리집 「부서 및 업무안내」(2026-09-24 조회 — 직위·담당업무만, 실명 쓰지 않음) · 데이터 판 <code>ops_v1.5_20260924</code>(공통) · <code>us_v1.1_20260924</code>(교육자료 버전 400) ·
생성기 <code>_build\\build_org_reorg_v15.py</code> · <code>build_approval_line_v15.py</code> · 검수 <code>check_integrity_v15.py</code> · 되돌리기용 이동 기록 <code>ops_v1.5_20260924\\_migration_log.csv</code>({len(log):,}칸)</p>
<h2>1. 요약</h2>
<ul>
<li>부서 15 → {len(org)} (새 부서 {sum(1 for o in org if o['dept_id'] >= 'D15' and o['dept_id'] != 'D99')}) · 직원 32 → {len(staff)} (부서마다 실무자·부서장, 총괄 확인 안전정책관, 경영책임자 시장). 부서 번호 D01~D14 는 그대로 두고 이름·실제 소속만 바로잡아 조인이 끊기지 않게 했다.</li>
<li>실제 조직과 다르던 이름: 중대재해예방과 → <b>안전정책관 중대재해예방팀</b> · 안전총괄과 → <b>안전점검팀</b> · 도로과(교량·터널) → <b>도로구조물과</b> · 재난안전과 → <b>재난대응담당관</b> · 하수도과 → <b>하수도사업소</b> · 공원녹지과 → <b>푸른공원사업소</b> · 교통정책과(경전철·주차장) → 교통정책과(주차) + <b>도시철도과</b>(경전철)</li>
<li>시설 소관 정정 {sum(mv.values())}곳 — 그 시설에 딸린 의무 배정·안전계획·신고·계약·재해·명령 기록의 부서도 함께 옮겼다(2장).</li>
<li>결재선 4단계: <b>실무자(주무관) 제출 → 부서장 확인 → 총괄(중대재해예방팀) 승인 → 경영책임자(시장) 보고 확인</b>. 앱의 증빙·결재 화면에 「부서장 확인 대기」 「총괄 승인 대기」 두 대기열, 이용자 고르기에 부서장 두 명(도로구조물과장 · 상수도사업소 정수과장)을 더했다. 총괄 승인은 부서장 확인 뒤에만 된다.</li>
<li>검수에서 드러난 기존 오류 2가지를 바로잡았다: ① 관리주체가 아닌 시설(판정 「제외」 — 학교·휴게소·우체국 등)에 「해당」으로 붙은 배정 243건 → <b>「확인필요」</b>(자동 비해당 처리하지 않음 — 담당이 의무 상세에서 확정) ② 내용과 무관한 학교 건물에 연결된 예시 기록 10건 → 시설 연결 해제.</li>
</ul>
<h2>2. 부서 · 결재선 (겹치는 업무는 책임이 큰 한 곳에 두고 「유관」에 적었다)</h2>
{tbl(["번호", "부서", "역할", "실제 소속", "맡는 일(누리집 담당업무 요지)", "유관 부서", "부서장", "실무자", "시설", "의무 배정"], orows)}
<h2>3. 시설 소관 정정</h2>
{tbl(["전 부서", "새 부서", "시설 수", "이유"], mrows)}
<p class="meta">바뀐 칸(표별): {" · ".join(f"{t} {n:,}" for t, n in ch.most_common())}</p>
<h2>4. 정합성 검수 — 재편 전 · 후 (같은 규칙)</h2>
{tbl(["검사", "전(v1.4 까지)", "후(v1.5)", "결과"], vrows)}
<ul>
<li><b>V4 안전점검팀 ← 건축과 시설 159</b>: 공공청사 등 제1·2종 건축물의 시설물안전법 점검(TG25)을 안전점검팀이 맡는 배정 — 누리집 담당업무(「공공청사시설물 안전점검」)와 맞아 그대로 둔다.</li>
<li>행 수가 바뀐 표: {fmt({k: f"{v[0]}→{v[1]}" for k, v in rep["행 수가 바뀐 표"].items()})} · 과제·증빙·결재 기록 수는 그대로.</li>
<li>화면 입력 저장 파일(v2 · 400)의 부서·직원 참조: {fmt(rep["화면 입력 저장 파일"])}.</li>
</ul>
<h2>5. 사람이 정해야 할 것</h2>
<ul>
<li>관리주체가 아닌 시설(판정 「제외」)에 걸려 「확인필요」로 표시한 배정 <b>243건</b>(과제 243) — 비해당으로 닫을지. 의무 상세의 「담당 · 해당 여부」에서 사유와 함께 확정.</li>
<li>보육정책과 · 체육진흥과 · 자원순환과 — 누리집 부서 목록(2026-09-24)에서 확인되지 않았다. 실제 소속·이름 확인 필요.</li>
<li>저수지(댐) 4곳(기흥 · 이동 · 용담 · 두창) — 한국농어촌공사 관리일 수 있다. 관리주체 확인 뒤 소관(재난대응담당관) 유지·제외 결정.</li>
<li>건축물 가운데 학교·휴게소·우체국·병원 등 용인시가 관리주체가 아닌 시설이 FMS(관할 구역 기준)에 함께 들어 있다 — 대부분 「제외」로 판정돼 있으나 원장(기관 자산 대장)으로 최종 확정 필요.</li>
<li>새 부서(도로건설과 · 산림과 · 공공건축과 · 대중교통과 · 안전정책팀 등)에는 아직 배정된 의무가 없다 — 해당 의무를 옮길지(예: 산사태취약지역·급경사지 → 산림과, 공공청사 건립 도급 → 공공건축과) 결정 필요. 추정으로 옮기지 않았다.</li>
</ul>
<h2>6. 앱 반영(v2 3300 · 교육자료 버전 400)</h2>
<ul>
<li>이용자 고르기: 경영책임자(시장) · 총괄(중대재해예방팀) · 관리자(안전점검팀) · <b>부서장(도로구조물과장)</b> · 실무자(도로구조물과) · <b>부서장(상수도사업소 정수과장)</b> · 실무자(상수도사업소)</li>
<li>증빙·결재: 부서장 확인(확인 · 반려) → 총괄 승인(승인 · 반려). 다시 제출하면 부서장 확인을 새로 받는다. 경영책임자 확인은 기존 「보고받음」(경영책임자 보고 요약).</li>
<li>설정 › 조직·담당자: 실제 소속 · 맡는 일 · 유관 부서 · 부서장 · 실무자 · 누리집 확인 여부.</li>
<li>원본(3100)·캡처본(3200)은 다시 켜지 않았다 — 다시 켜면 새 부서·직원은 읽지만 부서장 결재 화면은 없다.</li>
</ul>
</main>"""
io.open(OUT, "w", encoding="utf-8").write(f"<!doctype html><html lang='ko'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>조직 재편 정합성 검수</title><style>{css}</style></head><body>{body}</body></html>")
print(OUT)
