# -*- coding: utf-8 -*-
r"""
us_v1.7_20260925 — 용인시 공표 634 대조의 A·B 등급 시설을 관리대상(자산 표)에 편입한다(2026-09-25). 앞 판 그대로 · 이미 있으면 멈춘다.

사용자 결정(09-25) 원문
  1. 영덕교(0) 이행 시기 입력 4건은 「그대로 둬」.
  2. 「앞에 용인시 공표 자료 정리한 표 중에서 A와 B를 용인시 관리대상으로 편입하되, 절토사면은 2개뿐이었는데 B가 25개니까 이건 확인될 때까지 아직 반영하지 말자.」
편입 범위(메인 채팅 해석)
  · 교량 — us_v1.6 의 용인시 관리청 3종 97곳 그대로(고속국도 표기·확인 필요·보도육교는 넣지 않음)
  · 절토사면 — 넣지 않음
  · 그 밖의 공표 유형(터널, 옹벽, 건축물, 실내공기질 7종) — A·B 모두. 단 B 중 「타기관 의심」(명칭) 표시는 넣지 않음
    · 식품위생법·비료관리법·경전철은 이미 데모 표(원료·교통)에 있어 더할 것이 없다
    · 이미 데모 자산 표에 있는 시설은 다시 넣지 않는다(같은 FMS 번호). 같은 건물이 실내공기질 줄과 시설물 줄에 함께 있으면 한 번만
  · 공표 표에 없는 유형(공공하수처리시설·지방상수도·박물관·여객자동차터미널)은 건드리지 않는다
표시(앞 판 자산 표의 칸만 쓴다 — 앱 코드 불변)
  · A: 관리주체 용인시(FMS API 관리주체명) · 근거 「… · 용인시 공표(26.2) + FMS 대조 A」
  · B: 관리주체 용인시 · subject_source=estimated · subject_name 「용인시(확인필요)」 · verified=N · 근거 「… · 용인시 공표(26.2) + FMS 대조 B — 사유」
  · 실내공기질(별표 2 · 법 제2조제4호가목 · 시행령 제3조제1호) — asset_gbn 에 유형 이름(도서관·업무시설·실내공연장·지하 장례식장) → 대시보드 묶음에 그 이름으로 나온다.
    sapa_l2_result 에 「면적 확인 필요」·「객석 확인 필요」 → 관리대상 현황 목록의 「중대시민재해」 칸에 그대로 보인다.
  · 용인도시공사 운영 시설(평온의숲 장례식장)은 09-24 사용자 결정(「위탁 시설」 표시)을 따른다 — 관리주체 용인도시공사 · consign 표시.
  · 관리대상 코드: 기존 관례(교량·터널 TG03 · 옹벽 TG05 · 건축물 TG13 · 1·2종 TG25) + 실내공기질 도서관 TG10 · 업무시설 TG13 · 공연장 TG13 · 장례식장 TG13.
  · ★ us_v1.6 에서 3종 교량 97곳에 붙인 TG25(제1·2종 시설물)를 뗀다 — 3종은 1·2종이 아니다(앞 판 실수 정정, 앞 판 파일은 그대로).
  · 부서: 기존 관례(교량·터널·옹벽 D03 도로구조물과 · 건축물 D09 건축과) · 보건소 D11 · 농업기술센터 D14 · 도서관은 데모 조직에 도서관 부서가 없어 D99(미지정).
  · 이행 과제·배정·기록은 만들지 않는다.
입력  _관리대상후보_634대조_20260925\candidates.csv (생성기 build_candidates_634.py) · FMS 통합판정 · 앞 판 자산 표
출력  us_v1.7_20260925\seed\asset.csv · asset_target_map.csv · README.md · _634ab_log.csv  +  _CURRENT.json 의 us.data·us.history
"""
import csv, io, json, os, re, sys, collections as C

HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
VER = "us_v1.7_20260925"
V = os.path.join(DEMO, VER); OUT = os.path.join(V, "seed")
CAND = os.path.join(DEMO, "_관리대상후보_634대조_20260925", "candidates.csv")
FMS_P = os.path.join(DEMO, "..", "..", "..", "..", "20_개발", "개발내용 및 산출물", "용인시", "1차데모용", "용인시 관리 시설", "_FMS", "통합판정_용인시시설물_전체_20260906.csv")
CUR_P = os.path.join(DEMO, "_CURRENT.json")
if os.path.exists(V):
    sys.exit("이미 있다 — 덮어쓰지 않는다: " + V)
cur = json.load(io.open(CUR_P, encoding="utf-8"))
assert cur["us"]["data"] == "us_v1.6_20260925", ("앞 판이 예상과 다르다", cur["us"]["data"])


def read(p):
    with io.open(p, encoding="utf-8-sig") as f:
        r = csv.DictReader(f); return list(r.fieldnames), list(r)


def latest(t):
    """앱(lib/data.ts opsDirs)과 같은 순서 — us_* 새것부터, 그다음 ops_* 새것부터."""
    ds = os.listdir(DEMO)
    for pre in ("us_", "ops_"):
        for d in sorted((x for x in ds if x.startswith(pre)), reverse=True):
            p = os.path.join(DEMO, d, "seed", t + ".csv")
            if os.path.exists(p):
                return p
    raise SystemExit("표 없음: " + t)


pa, pm = latest("asset"), latest("asset_target_map")
ca, A = read(pa); cm, M = read(pm)
_, CD = read(CAND)
F = {f["facilNo"]: f for f in read(FMS_P)[1]}
have = {a["asset_id"] for a in A}
LAWS_BLD = C.Counter(a["mgmt_laws"] for a in A if a["asset_gbn"] == "건축물" and a.get("subject_tier") == "용인시").most_common(1)[0][0]
LAWS = {g: C.Counter(a["mgmt_laws"] for a in A if a["asset_gbn"] == g).most_common(1)[0][0] for g in ("터널", "옹벽")}

TYPES = ["터널", "옹벽", "건축물", "도서관", "업무시설", "지하 장례식장", "어린이집", "실내공연장", "실내체육시설", "실내어린이놀이시설"]
IAQ = {"도서관": ("7", "연면적", "면적 확인 필요", ["TG10"]), "업무시설": ("16", "연면적·용도", "면적 확인 필요", ["TG13"]),
       "지하 장례식장": ("14", "지하 위치·연면적", "지하·면적 확인 필요", ["TG13"]), "어린이집": ("11", "연면적", "면적 확인 필요", ["TG07"]),
       "실내공연장": ("18", "객석 수", "객석 확인 필요", ["TG13"]), "실내체육시설": ("19", "관람석 수", "관람석 확인 필요", ["TG09"]),
       "실내어린이놀이시설": ("12", "연면적", "면적 확인 필요", ["TG08"])}
OLD_BR = {a["asset_id"] for a in A if a.get("subject_source") == "law" and "bridge_road_authority" in (a.get("subject_note") or "")}
assert len(OLD_BR) == 97, len(OLD_BR)

stat = C.Counter()
log, NA, NM, seen = [], [], [], set()


def clean(name):
    return re.sub(r"\s*=\s*FMS 「.*」$", "", name).strip()


def dept_of(typ, name, f):
    if typ in ("터널", "옹벽"):
        return "D03", ""
    if typ == "도서관":
        return "D99", "데모 조직에 도서관 부서가 없어 미지정(공표 관리부서: 동부·중부·서부도서관)"
    if "보건소" in name:
        return "D11", ""
    if "농업기술센터" in name:
        return "D14", ""
    return "D09", "추정 — 기존 건축물 관례(건축과)"


seq = 0
# 같은 건물이 시설물 줄(건축물 A 등)과 실내공기질 줄에 함께 있으면 시설물 줄을 먼저 — 등급이 더 확실한 줄로 한 번만 넣는다
CD = sorted(CD, key=lambda r: (0 if r["유형"] in ("터널", "옹벽", "건축물") else 1, int(r["번호"])))
for r in CD:
    typ, gr = r["유형"], r["등급"]
    if typ not in TYPES or gr not in ("A", "B"):
        continue
    if r["타기관 의심(명칭)"]:
        stat[(typ, "제외(타기관 의심)")] += 1
        log.append({"table": "asset", "key": r["FMS 번호"] or r["시설명"], "col": "(편입 안 함)", "old": "", "new": r["시설명"], "why": "B 타기관 의심 — " + r["타기관 의심(명칭)"]})
        continue
    no = r["FMS 번호"]
    key = no or ("%s|%s" % (typ, clean(r["시설명"])))
    if no and (no in have or no in seen):
        stat[(typ, "이미 데모" if no in have else "같은 건물 앞 줄에서 편입")] += 1
        continue
    if key in seen:
        continue
    seen.add(key)
    f = F.get(no, {})
    a = {c: "" for c in ca}
    name = clean(r["시설명"])
    tag = "용인시 공표(26.2) + FMS 대조 %s" % gr + ("" if gr == "A" else " — " + r["사유"])
    dept, dnote = dept_of(typ, name, f)
    if typ in IAQ:
        no_, need, sapa, codes = IAQ[typ]
        basis = "법 제2조제4호가목 · 시행령 제3조제1호 · 별표 2 제%s호 · %s" % (no_, tag)
        gbn, kind, cls = typ, (f.get("facilKind") or "실내공기질 대상 후보"), f.get("facilClass", "")
        laws = "실내공기질 관리법"
    else:
        cls = f.get("facilClass", "")
        gbn, kind = typ, f.get("facilKind", "")
        if typ == "터널":
            basis = ("시행령 별표3 제2호" if cls in ("1종", "2종") else "시행령 제3조제4호 나목") + " · " + tag
            need, sapa, codes, laws = ("관리주체" if gr == "B" else "연장·차로수"), "검토필요", ["TG03"] + (["TG25"] if cls in ("1종", "2종") else []), LAWS["터널"]
        elif typ == "옹벽":
            basis = "시행령 별표3 제8호 · " + tag
            need, sapa, codes, laws = "노출높이·수평연장", "검토필요", ["TG05"] + (["TG25"] if cls in ("1종", "2종") else []), LAWS["옹벽"]
        else:
            basis = "시행령 별표3 제5호 2)3) · " + tag
            need, sapa, codes, laws = "연면적·층수·용도", "검토필요", ["TG13"] + (["TG25"] if cls in ("1종", "2종") else []), LAWS_BLD
    firm = gr == "A"
    corp = r["관리주체"].startswith("용인도시공사")
    if no:
        aid = no
    else:
        seq += 1
        aid = "IQ-YI-%04d" % seq
    a.update({
        "asset_id": aid, "asset_name": name, "asset_gbn": gbn, "asset_kind": kind, "asset_class": cls,
        "safety_grade": f.get("sfGrade", ""), "completed_ymd": f.get("cplYmd", ""), "addr": r["주소"] or f.get("addr", ""),
        "dept_id": dept, "source": "FMS" if no else "용인시 공표 대조(누리집 · 사업장 조사)", "sapa_l2_result": sapa, "sapa_basis": basis,
        "need_data": need, "verified": "N",
        "subject_tier": "용인도시공사" if corp else "용인시",
        "subject_name": ("용인도시공사(운영 · 확인필요)" if corp else (f.get("mngMbyNm") and ("용인시 " + f["mngMbyNm"]).replace("용인시 용인시", "용인시") if firm else "용인시(확인필요)")),
        "subject_source": "api" if firm and f.get("subject_source") == "api" else "estimated",
        "subject_note": ("확인필요 — " if not firm else "") + r["관리주체 근거"][:120] + ((" · 관리부서 " + dnote) if dnote else ""),
        "mgmt_class": "위탁 시설(용인도시공사 운영)" if corp else "중처법 공중이용시설", "mgmt_laws": laws,
    })
    if corp:
        a["consign"] = "위탁(용인도시공사 운영)"
        a["consign_note"] = "09-24 결정(용인도시공사 운영 시설 = 위탁 시설 표시) · 장례식장이 있는지·지하에 있는지·면적 확인 필요"
    NA.append(a)
    for code in codes:
        m = {c: "" for c in cm}
        m.update({"asset_id": aid, "target_code": code, "basis": "634 대조 %s 편입(us_v1.7) — %s" % (gr, typ), "confidence": "medium" if firm else "low"})
        NM.append(m)
    stat[(typ, gr)] += 1
    log.append({"table": "asset", "key": aid, "col": "(새 행)", "old": "", "new": name, "why": "634 대조 %s · %s" % (gr, typ)})

# us_v1.6 3종 교량의 TG25 떼기(3종은 제1·2종 시설물이 아니다)
M2 = [m for m in M if not (m["asset_id"] in OLD_BR and m["target_code"] == "TG25")]
fixed = len(M) - len(M2)
for b in sorted(OLD_BR):
    log.append({"table": "asset_target_map", "key": b, "col": "target_code", "old": "TG25", "new": "(뗌)", "why": "3종 교량 — 제1·2종 시설물 코드 잘못 붙임(us_v1.6) 정정"})
assert fixed == 97, fixed

os.makedirs(OUT)
for name, cols, rows in (("asset", ca, A + NA), ("asset_target_map", cm, M2 + NM)):
    with io.open(os.path.join(OUT, name + ".csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
with io.open(os.path.join(V, "_634ab_log.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["table", "key", "col", "old", "new", "why"]); w.writeheader(); w.writerows(log)
lines = ["| 유형 | A 편입 | B 편입 | 이미 데모에 있음 | 같은 건물 앞 줄 | 제외(타기관 의심) |", "|---|---:|---:|---:|---:|---:|"]
for t in TYPES:
    lines.append("| %s | %d | %d | %d | %d | %d |" % (t, stat[(t, "A")], stat[(t, "B")], stat[(t, "이미 데모")], stat[(t, "같은 건물 앞 줄에서 편입")], stat[(t, "제외(타기관 의심)")]))
io.open(os.path.join(V, "README.md"), "w", encoding="utf-8").write(
    "# %s\n\n용인시 공표 634 대조의 A·B 등급 시설 %d곳을 관리대상(자산 표)에 편입(사용자 결정 09-25). 교량은 us_v1.6 그대로 · 절토사면은 넣지 않음 · B 중 타기관 의심은 넣지 않음.\n"
    "생성기 `_build\\build_us_v17_634ab.py` · 입력 `_관리대상후보_634대조_20260925\\candidates.csv`. 앞 판 자산 `%s`(%d행) · 연결 `%s`(%d행)을 옮기고 새 행만 더했다. 이행 과제·배정·기록은 만들지 않았다.\n"
    "정정: us_v1.6 3종 교량 97곳의 TG25(제1·2종 시설물) 연결 %d행을 뗐다.\n\n%s\n"
    % (VER, len(NA), os.path.relpath(pa, DEMO), len(A), os.path.relpath(pm, DEMO), len(M), fixed, "\n".join(lines)))
cur["us"]["data"] = VER
cur["us"]["history"] = cur["us"]["history"] + [VER]
cur["updated_at"] = "2026-09-25 (us_v1.7 — 634 대조 A·B %d곳 관리대상 편입, 과제 없음 · 3종 교량 TG25 정정)" % len(NA)
tmp = CUR_P + ".tmp"
io.open(tmp, "w", encoding="utf-8").write(json.dumps(cur, ensure_ascii=False, indent=1))
os.replace(tmp, CUR_P)
print("앞 판 자산 %s %d행 · 연결 %s %d행 → 자산 %d · 연결 %d(TG25 정정 −%d)" % (os.path.relpath(pa, DEMO), len(A), os.path.relpath(pm, DEMO), len(M), len(A) + len(NA), len(M2) + len(NM), fixed))
print("\n".join(lines))
print("새 자산 구분", dict(C.Counter((a["asset_gbn"], a["subject_tier"], a["dept_id"]) for a in NA)))
