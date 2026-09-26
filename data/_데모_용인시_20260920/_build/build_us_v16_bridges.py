# -*- coding: utf-8 -*-
r"""
us_v1.6_20260925 — 교육자료 버전(3400)에 「용인시 도로관리청 3종 도로교량」을 관리대상으로 더한다(2026-09-25).
사용자 결정(09-25): 「용인시 관리 교량만 반영해줘.」

근거  _관리대상후보_634대조_20260925\bridge_road_authority.csv (생성기 build_bridge_authority.py)
      · 634 대조에서 B 로 둔 교량 310건 중 3종 도로교량(시행령 제3조제4호가목 — 연장 20m 이상·준공 10년)
      · 「도로법」 제23조(도로관리청) · 제16조(시도) — 동 지역이고 고속국도·나들목 표기가 없고 국도 우회 의심 동이 아닌 것 = 판정 「용인시」
      · 규칙 검증: 관리주체가 FMS API 로 확인된 1·2종 교량에 같은 규칙 → 「용인시」 50건 모두 실제 용인시
규칙(앞 판 선례 build_consign_v21 · build_subject_axis_v17 · build_us_v15_workplaces 를 따름)
  · 앞 판은 그대로 둔다. 이 판 폴더가 이미 있으면 멈춘다.
  · 자산 표·관리대상 연결 표는 앞 판(앱이 읽는 순서 — us 새것부터, 그다음 ops 새것부터)의 형식·행을 그대로 옮기고 새 교량만 더한다.
  · 새 교량: 관리주체 용인시(subject_source=law · 도로법 관리청 판정) · 관리 구분 「중처법 공중이용시설」 · 근거 「시행령 제3조제4호 가목」
    · 판정 「검토필요」(기존 교량과 같음) · 관리대상 코드 TG03·TG25(기존 교량과 같음) · 부서 D03 도로구조물과(기존 교량 관례 — 담당 구청 도로과는 추정으로 적음)
  · 이행 과제·배정·기록은 만들지 않는다 → 대시보드 개수와 관리대상 목록에만 나온다. 이행률은 과제·기록에서 세므로 바뀌지 않는다.
출력  us_v1.6_20260925\seed\asset.csv · asset_target_map.csv · README.md · _bridge_log.csv  +  _CURRENT.json 의 us.data·us.history
"""
import csv, io, json, os, sys, collections as C

HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
VER = "us_v1.6_20260925"
V = os.path.join(DEMO, VER); OUT = os.path.join(V, "seed")
SRC = os.path.join(DEMO, "_관리대상후보_634대조_20260925", "bridge_road_authority.csv")
FMS = os.path.join(DEMO, "..", "..", "..", "..", "20_개발", "개발내용 및 산출물", "용인시", "1차데모용", "용인시 관리 시설", "_FMS", "통합판정_용인시시설물_전체_20260906.csv")
CUR_P = os.path.join(DEMO, "_CURRENT.json")
if os.path.exists(V):
    sys.exit("이미 있다 — 덮어쓰지 않는다: " + V)
cur = json.load(io.open(CUR_P, encoding="utf-8"))
assert cur["us"]["data"] == "us_v1.5_20260924", ("앞 판이 예상과 다르다", cur["us"]["data"])


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
_, J = read(SRC)
F = {f["facilNo"]: f for f in read(FMS)[1]}
have = {a["asset_id"] for a in A}
old_br = [a for a in A if a["asset_gbn"] == "교량"]
tg = C.Counter(m["target_code"] for m in M if m["asset_id"] in {a["asset_id"] for a in old_br})
assert set(tg) == {"TG03", "TG25"}, tg                      # 기존 교량의 관리대상 코드
laws = C.Counter(a["mgmt_laws"] for a in old_br).most_common(1)[0][0]
depts = C.Counter(a["dept_id"] for a in old_br)
assert list(depts) == ["D03"], depts                        # 기존 교량 관례 = 도로구조물과

new = [j for j in J if j["데모 반영"] == "반영"]
assert all(j["판정"] == "용인시" and j["종별·종류"] == "3종 도로교량" for j in new)
log, NA, NM = [], [], []
for j in new:
    no = j["FMS 번호"]
    if no in have:
        continue
    f = F[no]
    a = {c: "" for c in ca}
    a.update({
        "asset_id": no, "asset_name": f["facilNm"], "asset_gbn": "교량", "asset_kind": f["facilKind"], "asset_class": f["facilClass"],
        "safety_grade": f["sfGrade"], "completed_ymd": f["cplYmd"], "addr": f["addr"], "dept_id": "D03", "source": "FMS",
        "sapa_l2_result": "검토필요", "sapa_basis": "시행령 제3조제4호 가목",
        "need_data": "연장(m)·도로 노선(시도·국도·지방도)", "verified": "N",
        "subject_tier": "용인시", "subject_name": j["관리부서(추정)"] + "(추정)", "subject_source": "law",
        "subject_note": "도로법 제23조(도로관리청)·제16조(시도) — 동 지역·고속국도 표기 없음으로 판정한 용인시 관리청(2026-09-25 · bridge_road_authority.csv). "
                        "노선 대장 확인 전 · 담당 구청 도로과는 추정",
        "mgmt_class": "중처법 공중이용시설", "mgmt_laws": laws,
    })
    NA.append(a)
    for code in ("TG03", "TG25"):
        m = {c: "" for c in cm}
        m.update({"asset_id": no, "target_code": code, "basis": "FMS 구분·종류 규칙(3종 도로교량 · 도로법 관리청 판정 us_v1.6)", "confidence": "medium"})
        NM.append(m)
    log.append({"table": "asset", "key": no, "col": "(새 행)", "old": "", "new": f["facilNm"],
                "why": "용인시 도로관리청 3종 도로교량 — " + j["판정 근거 조문"][:60]})
os.makedirs(OUT)
for name, cols, rows in (("asset", ca, A + NA), ("asset_target_map", cm, M + NM)):
    with io.open(os.path.join(OUT, name + ".csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
with io.open(os.path.join(V, "_bridge_log.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["table", "key", "col", "old", "new", "why"]); w.writeheader(); w.writerows(log)
io.open(os.path.join(V, "README.md"), "w", encoding="utf-8").write(
    "# %s\n\n용인시 도로관리청으로 판정한 3종 도로교량 %d곳을 관리대상(자산 표)에 더했다(사용자 결정 09-25 「용인시 관리 교량만 반영해줘.」).\n"
    "생성기 `_build\\build_us_v16_bridges.py` · 근거 `_관리대상후보_634대조_20260925\\bridge_road_authority.csv`(도로법 제23조·제16조).\n"
    "앞 판 자산 표 `%s`(%d행) + 관리대상 연결 `%s`(%d행)을 그대로 옮기고 새 행만 더했다. 이행 과제·배정·기록은 만들지 않았다.\n"
    "되돌리기: 이 폴더를 쓰지 않으면(`_CURRENT.json` us.data = us_v1.5_20260924) 그대로 원상 — 앱은 us_* 새 판부터 읽으므로 폴더 이름을 바꾸거나 옮겨야 한다.\n"
    % (VER, len(NA), os.path.relpath(pa, DEMO), len(A), os.path.relpath(pm, DEMO), len(M)))
cur["us"]["data"] = VER
cur["us"]["history"] = cur["us"]["history"] + [VER]
cur["updated_at"] = "2026-09-25 (us_v1.6 — 용인시 도로관리청 3종 도로교량 %d곳 관리대상 추가, 과제 없음)" % len(NA)
tmp = CUR_P + ".tmp"
io.open(tmp, "w", encoding="utf-8").write(json.dumps(cur, ensure_ascii=False, indent=1))
os.replace(tmp, CUR_P)
print("앞 판 자산 %s %d행 · 연결 %s %d행" % (os.path.relpath(pa, DEMO), len(A), os.path.relpath(pm, DEMO), len(M)))
print("새 교량 %d · 연결 %d · 교량 %d → %d" % (len(NA), len(NM), len(old_br), len(old_br) + len(NA)))
print("구청별", dict(C.Counter(a["subject_name"] for a in NA)))
