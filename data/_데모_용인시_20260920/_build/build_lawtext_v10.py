# -*- coding: utf-8 -*-
r"""
lawtext_v1.0_20260924 — 앱(3400)이 「조문 보기」에서 보여 줄 법령 원문 저장소(2026-09-24 사용자 지시).

사용자: 「조문보기를 누르면 조문 정보만 있고 법조문 원문이 없네? 정본 DB에서 다 수집하고 구분까지 한 거라서
        그거 불러오면 될 텐데, 한번 불러와서 정본 원문을 구축하고, 갱신된 게 확인될 때마다 현행화를 하면 될 거 같애.」

· 원천 = 정본 **발행 판**(build\_RELEASE.json 이 가리키는 unit · doc · schedule) — 읽기만. 파일명을 박지 않는다(E66).
· 범위 = 우리 의무 목록(duty_class, 앱이 읽는 판 전부의 합집합)에 나오는 문서의 **전문**(조·항·호·목 전부)
         + 의무가 가리키는 별표.
· 정렬·표시명 = 정본 라이브러리 lib_naming(parse_unit_path · sort_key) — 새로 짜지 않는다.
· 현행화 = 이 판은 고치지 않는다. 법령 개정 자동 확인(CoCo)이 반영한 실행의 items.csv(새 본문·시행일)를
           앱이 이 판 위에 얹는다(lib/lawtext.ts). 정본이 새로 발행되면 lawtext_v1.1 을 새로 만든다.
· 이미 있으면 멈춘다(판 덮어쓰기 금지).

출력
  lawtext_v1.0_20260924\_meta.json          판 정보(정본 발행 판·만든 때·문서·조항호목 수)
  lawtext_v1.0_20260924\doc_index.csv       문서 목록(제목·규범 형식·시행일·최종 개정일·법제처 MST)
  lawtext_v1.0_20260924\doc\<doc_id>.json   문서 하나의 조항호목 전부(정렬됨)
  lawtext_v1.0_20260924\schedule.json       의무가 가리키는 별표 본문
  lawtext_v1.0_20260924\unit_doc.json       의무 조항호목 → 문서(의무 행에 doc_id 가 빈 경우)
"""
import csv, io, json, os, sys, glob, datetime, collections as C
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(DEMO, "_agent"))
sys.path.insert(0, os.path.join(os.path.dirname(DEMO), "script"))
import common                      # canon_release · canon_path (발행 판만)
import lib_naming as N             # parse_unit_path · sort_key

V = os.path.join(DEMO, "lawtext_v1.0_20260924")
if os.path.exists(V):
    sys.exit("이미 있다 — 덮어쓰지 않는다: " + V)

rel = common.canon_release()
print("정본 발행 판", rel["release"], rel["published_at"])

# 1) 범위 — 앱이 읽는 모든 판의 duty_class 합집합
docs, sched, units = set(), set(), set()
for p in glob.glob(os.path.join(DEMO, "*_v*", "seed", "duty_class.csv")):
    for r in common.rd(p):
        if r.get("doc_id"): docs.add(r["doc_id"])
        if r.get("unit_id"): units.add(r["unit_id"])      # doc_id 칸이 빈 의무 행(349)도 조항호목 번호로 문서를 찾는다
        if r.get("schedule_id"): sched.add(r["schedule_id"])
with io.open(common.canon_path("unit"), encoding="utf-8-sig", newline="") as f:
    for r in csv.DictReader(f):
        if r["unit_id"] in units:
            docs.add(r["doc_id"])
for r in common.rd(common.canon_path("schedule")):
    if r["schedule_id"] in sched:
        docs.add(r["doc_id"])
print("의무 문서", len(docs), "조항호목", len(units), "별표", len(sched))

# 2) 문서 머리
dmeta = {}
for r in common.rd(common.canon_path("doc")):
    if r["doc_id"] in docs:
        dmeta[r["doc_id"]] = r
miss = docs - set(dmeta)
if miss:
    print("정본 doc 에 없는 문서", len(miss), sorted(miss)[:5])

# 3) 조항호목 — 문서별로 모은다(삭제 표시는 담되 표시)
by = C.defaultdict(list)
with io.open(common.canon_path("unit"), encoding="utf-8-sig", newline="") as f:
    for r in csv.DictReader(f):
        if r["doc_id"] not in docs:
            continue
        by[r["doc_id"]].append(r)

def key(r):
    try:
        return (0,) + N.sort_key(N.parse_unit_path(r["unit_path"]))
    except Exception:
        return (1, r["unit_path"])     # 경로 모양이 다른 행(조 번호 없는 본문 등)은 뒤로, 경로 순

os.makedirs(os.path.join(V, "doc"))
nunit = 0
for d, rs in by.items():
    rs.sort(key=key)
    out = []
    for r in rs:
        out.append({
            "u": r["unit_id"], "p": r["unit_path"], "l": r["unit_label"], "t": r["unit_type"], "d": r["depth"],
            "ti": r["article_title"], "x": r["display_text"] or r["unit_text"], "e": r["effective_from"],
            "del": "Y" if r["is_deleted"] in ("True", "true", "1", "Y") else "",
        })
    nunit += len(out)
    m = dmeta.get(d, {})
    with io.open(os.path.join(V, "doc", d + ".json"), "w", encoding="utf-8") as f:
        json.dump({"doc_id": d, "title": m.get("title_ko", ""), "norm_form": m.get("norm_form", ""),
                   "effective_from": m.get("effective_from", ""), "last_amended_at": m.get("last_amended_at", ""),
                   "nlic_mst": m.get("nlic_mst", ""), "units": out}, f, ensure_ascii=False, separators=(",", ":"))

# 4) 별표
sch = {}
for r in common.rd(common.canon_path("schedule")):
    if r["schedule_id"] in sched:
        sch[r["schedule_id"]] = {"doc_id": r["doc_id"], "path": r["schedule_path"], "kind": r["schedule_kind"],
                                 "title": r["title_ko"], "x": r["schedule_text"]}
with io.open(os.path.join(V, "schedule.json"), "w", encoding="utf-8") as f:
    json.dump(sch, f, ensure_ascii=False, separators=(",", ":"))

common.wr(os.path.join(V, "doc_index.csv"),
          [{"doc_id": d, "title": dmeta.get(d, {}).get("title_ko", ""), "norm_form": dmeta.get(d, {}).get("norm_form", ""),
            "effective_from": dmeta.get(d, {}).get("effective_from", ""), "last_amended_at": dmeta.get(d, {}).get("last_amended_at", ""),
            "nlic_mst": dmeta.get(d, {}).get("nlic_mst", ""), "units": len(by.get(d, []))} for d in sorted(docs)])

# 5) 의무 조항호목 → 문서 색인(의무 행의 doc_id 가 빈 349건 — 앱이 여기서 찾는다)
udoc = {}
for d, rs in by.items():
    for r in rs:
        if r["unit_id"] in units:
            udoc[r["unit_id"]] = d
with io.open(os.path.join(V, "unit_doc.json"), "w", encoding="utf-8") as f:
    json.dump(udoc, f, ensure_ascii=False, separators=(",", ":"))

meta = {"version": "lawtext_v1.0_20260924", "canon_release": rel["release"], "canon_published_at": rel["published_at"],
        "built_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), "docs": len(by), "docs_wanted": len(docs),
        "units": nunit, "schedules": len(sch), "schedules_wanted": len(sched),
        "update_rule": "앱이 법령 개정 자동 확인(CoCo)에서 반영한 실행의 items.csv 새 본문을 이 판 위에 얹는다 — 시행일이 오늘 이후면 「시행 예정」으로 따로 보인다."}
with io.open(os.path.join(V, "_meta.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=1)
print(json.dumps(meta, ensure_ascii=False, indent=1))
