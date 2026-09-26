# -*- coding: utf-8 -*-
r"""
CoCo — 체크리스트 생성 작업 총괄(2026-09-24). 앱의 「오늘 개정 확인」 단추가 이 파일을 뒤에서 돌린다.

★ 원칙(사용자 09-24): 새 로직을 짜지 않고 **정본 파이프라인의 기존 스크립트를 포장**한다.
   기존 스크립트는 격리 실행기(sandbox.py) 안에서 **수정 없이** 돈다 — 정본 쪽 쓰기는 실행 폴더로 돌려진다.
   이 파일이 새로 하는 일은 「단계 사이 파일 잇기 · 우리 기관 의무와 맞대기 · 결과 정리」뿐이다.

단계(하위 작업자)와 쓰는 기존 코드
  ① 개정 감시
       법령  script\diag_version_overlap_20260920.py  (판 목록 · 판 겹침 E74 · 「정본이 낡은 판」)
             — 같은 모듈의 versions() 로 오늘 캐시를 병렬로 미리 채운다(옛 09-20 캐시로 판단하지 않게)
       고시  script\fetch_delegated_admrule_20260914.py 의 current_of() 규칙(현행연혁구분=현행 · 행정규칙ID) — 그 스크립트는
             모듈 첫머리에서 바로 돌아 import 할 수 없어 조회 규칙만 옮겼다(아래 admin_current)
  ② 원문 대조
       script\fix_stale_mst_20260920.py      새 판 원문 받기(제목 일치 assert) · 판 번호 갈아타기 — 정본 쓰기는 격리
       script\fix_stale_law_text_20260920.py --dry  조항호목 대조(본문 바뀜 · 개정 신설 · 현행에 없음 · 판 겹침 건너뜀 · 별표 자리/제목 대조)
       script\lawxml_units.py                 옛/새 본문을 보여 주려고 같은 분해기로 새 원문을 읽는다
  ③ 의무 판단
       script\report_recollect_queue_20260917.py  바뀐 조항호목에 붙은 역할·의무 앵커·근거·관리대상·적용조건 → 「재검토 필요」
       script\duty_predicate.py                   의무 술어 계측기(E69 — 넓혀 온 것 그대로)
       script\audit_lesson_guard.py               오류교훈 ↔ 강제 장치 대조(문서뿐인 교훈 = 재발 후보)
       판정 자체는 하지 않는다 — 판정 규칙 v1.3 · 원칙 4 에 따라 전부 「확인필요」로 사람에게 넘긴다.
       (정본도 09-20 갱신 때 판정은 건드리지 않고 재검토 대기열로 냈다 — fix_stale_law_text 머리 주석)
  ④ 관리대상 연결  우리 기관 의무(duty_class) · 배정(duty_assignment) · 관리대상 연결(asset_target_map)을 읽어
       바뀐 조항호목에 걸린 의무·배정·과제·부서를 세고, 새 조문은 같은 조·같은 문서의 기존 의무가 걸린 관리대상으로 잇는다
       (배정 범위 규칙은 _build\build_ops_tables.py 와 같게: TG24·TG26 = 기관 단위, 주기 = TYPE_CYCLE)
  ⑤ 결과 정리  개정 현황(law_change) · 판단 항목(items) · 요약 → 앱에 반영 요청(앱이 공용 쓰기 경로로 쓴다)

실행   python coco.py [--run-id RUN-…] [--by 직원번호] [--app http://localhost:3400] [--only 제목,…] [--bottomup]
"""
import argparse, collections, concurrent.futures as cf, csv, importlib, io, json, os, re, subprocess, sys, time
import urllib.parse, urllib.request

from common import (BUILD, CACHE, DB, DEMO, LS, RUNS, SCRIPT, STATE, Run, api, canon_path, canon_release, dash, latest_seed,
                    now, rd, tag, wr, ymd)

PY = sys.executable
SANDBOX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sandbox.py")
COLLECT = os.path.dirname(DB)
LAYERS = ("법률", "시행령", "시행규칙", "부령규칙")          # diag_version_overlap 과 같은 범위
APPLIED = os.path.join(STATE, "applied_versions.json")


def jload(p, d):
    try:
        return json.load(io.open(p, encoding="utf-8"))
    except Exception:
        return d


def jsave(p, o):
    io.open(p + ".tmp", "w", encoding="utf-8").write(json.dumps(o, ensure_ascii=False, indent=1))
    os.replace(p + ".tmp", p)


def sandbox(R, agent, name, script, args=(), maps=(), prefixes=()):
    """기존 스크립트 하나를 격리 실행기로 돌린다. 출력 줄은 그대로 기록에 남긴다."""
    cmd = [PY, SANDBOX, "--script", os.path.join(SCRIPT, script), "--run", R.dir, "--name", name]
    for a, b in maps:
        cmd += ["--map", "%s=>%s" % (a, b)]
    for a, b in prefixes:
        cmd += ["--prefix", "%s=>%s" % (a, b)]
    cmd += ["--"] + list(args)
    R.log(agent, "기존 도구 실행: %s %s" % (script, " ".join(args)), level="실행")
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    t0 = time.time()
    # 창을 띄우지 않는다(윈도에서 하위 파이썬마다 명령창이 뜨던 것 — 09-24 사용자)
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
    p = subprocess.run(cmd, cwd=SCRIPT, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env, creationflags=flags)
    lines = [x for x in (p.stdout or "").splitlines() if x.strip()]
    for x in lines[-14:]:
        R.log(agent, x.strip()[:300], level="도구 출력")
    if p.returncode != 0:
        R.log(agent, "도구 실패(%s) — %s" % (p.returncode, (p.stderr or "")[-400:]), level="오류")
    red = jload(os.path.join(R.dir, "_out", name, "_redirect.json"), {})
    R.log(agent, "%s 끝 — %.0f초 · 정본 쪽 쓰기 %d건은 실행 폴더로 돌림 · 막은 삭제 %d" %
          (script, time.time() - t0, len(red.get("redirected_writes", {})), len(red.get("blocked", []))))
    return p.returncode, red.get("redirected_writes", {}), lines


def red_of(red, basename):
    for k, v in red.items():
        if os.path.basename(k) == basename or os.path.basename(v) == basename:
            return v
    return ""


# ── 우리 기관의 관계법령 목록 ─────────────────────────────────────────
def our_docs():
    dc = rd(latest_seed("duty_class"))
    ids = {r["doc_id"] for r in dc if r.get("doc_id")}
    docs = rd(canon_path("doc"))
    titles = {d["title_ko"] for d in docs if d["doc_id"] in ids}
    return dc, docs, titles


# ── ① 개정 감시 ──────────────────────────────────────────────────────
def watch_law(R, titles_all):
    """diag_version_overlap 을 오늘 캐시로 돌린다. 캐시는 같은 모듈의 versions() 로 병렬로 먼저 채운다."""
    day = os.path.join(CACHE, "eflaw_" + R.asof)
    os.makedirs(day, exist_ok=True)
    M = importlib.import_module("diag_version_overlap_20260920")
    M.CACHE = day
    todo = sorted(titles_all)
    R.step("watch", total=len(todo), done=0, note="법령 판 목록 조회 중")
    done = [0]

    def one(t):
        try:
            M.versions(t)
        except Exception as e:  # noqa — 실패는 도구가 다시 「조회 실패」로 적는다
            R.log("watch", "판 목록 조회 실패 %s — %s" % (t, str(e)[:60]), level="경고")
        done[0] += 1
        if done[0] % 50 == 0:
            R.step("watch", done=done[0])
    with cf.ThreadPoolExecutor(max_workers=6) as ex:        # 하위 작업자 6
        list(ex.map(one, todo))
    R.step("watch", done=len(todo))
    old_cache = os.path.join(DB, "_정본미확보목록", "_eflaw_cache_20260920")
    rc, red, _ = sandbox(R, "watch", "watch_law", "diag_version_overlap_20260920.py", prefixes=[(old_cache, day)])
    out = red_of(red, "(점검)판겹침_법령_20260920.csv")
    return rd(out) if out and os.path.exists(out) else [], day


def admin_current(title):
    """fetch_delegated_admrule_20260914.current_of() 의 규칙 — 현행연혁구분=현행 인 행정규칙(같은 이름)."""
    y = api("lawSearch.do", {"target": "admrul", "type": "XML", "query": title, "nw": "2", "display": "100"})
    rows = []
    for b in re.findall(r"<admrul id=.*?</admrul>", y, re.S):
        if tag(b, "행정규칙명") == title and tag(b, "현행연혁구분") == "현행":
            rows.append({"seq": tag(b, "행정규칙일련번호"), "rid": tag(b, "행정규칙ID"), "prom": tag(b, "발령일자"),
                         "no": tag(b, "발령번호"), "eff": tag(b, "시행일자"), "rev": tag(b, "제개정구분명")})
    return rows


def watch_admin(R, admin_docs):
    base = jload(os.path.join(STATE, "admin_baseline.json"), {})
    out = []

    def one(d):
        t = d["title_ko"]
        r = {"문서": t, "계층": d.get("legacy_layer", ""), "doc_id": d["doc_id"], "정본 발령": d.get("last_amended_at", ""),
             "정본 발령번호": d.get("promulgated_no", ""), "현행 일련번호": "", "현행 발령": "", "현행 시행": "", "개정 구분": "", "판정": ""}
        try:
            cur = admin_current(t)
        except Exception as e:  # noqa
            r["판정"] = "조회 실패: %s" % str(e)[:40]
            return r
        if not cur:
            r["판정"] = "현행 없음(폐지·이름 변경 확인)"
            return r
        c = max(cur, key=lambda x: (x["prom"], x["seq"]))
        r.update({"현행 일련번호": c["seq"], "현행 발령": c["prom"], "현행 시행": c["eff"], "개정 구분": c["rev"]})
        b = base.get(t, {})
        ref = re.sub(r"\D", "", b.get("prom") or d.get("last_amended_at") or "")[:8]
        if not ref:
            r["판정"] = "기준 기록(처음)"
        elif c["prom"] > ref:
            r["판정"] = "개정됨(기준 발령 %s → 현행 %s)" % (dash(ref), dash(c["prom"]))
        else:
            r["판정"] = "이상 없음"
        return r
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        out = list(ex.map(one, admin_docs))
    for r in out:
        if r["판정"] == "기준 기록(처음)" and r["현행 발령"]:
            base[r["문서"]] = {"prom": r["현행 발령"], "seq": r["현행 일련번호"], "at": now()}
    jsave(os.path.join(STATE, "admin_baseline.json"), base)
    wr(R.path("watch_admin.csv"), out)
    return out


# ── ② 원문 대조 ──────────────────────────────────────────────────────
def diff_law(R, stale_rows, docs):
    """정본 09-20 절차 그대로: fix_stale_mst(판 갈아타기·원문 받기) → fix_stale_law_text --dry(조항호목 대조)."""
    if not stale_rows:
        return [], {}
    os.makedirs(R.path("in"), exist_ok=True)
    src = R.path("in/overlap_stale.csv")
    wr(src, stale_rows)
    man = canon_release()
    man = dict(man, state="writing", writing_tables="all")          # 격리 안에서만 쓰기 표지(정본 표지는 그대로)
    relp = R.path("in/_RELEASE_writing.json")
    io.open(relp, "w", encoding="utf-8").write(json.dumps(man, ensure_ascii=False))
    xml = os.path.join(CACHE, "lawxml")
    old_xml = os.path.join(COLLECT, "lawxml_현행대조_20260920")
    rc, red, _ = sandbox(R, "diff", "fix_mst", "fix_stale_mst_20260920.py", args=["--tag", "lawsync"],
                         maps=[(os.path.join(DB, "_정본미확보목록", "(점검)판겹침_법령_20260920.csv"), src),
                               (os.path.join(BUILD, "_RELEASE.json"), relp)],
                         prefixes=[(old_xml, xml)])
    new_doc = red_of(red, os.path.basename(canon_path("doc")))
    if not new_doc:
        R.log("diff", "판 갈아타기 결과(doc)가 없다 — 원문 대조를 건너뛴다", level="오류")
        return [], {}
    titles = {r["문서"] for r in stale_rows}
    ids = [d["doc_id"] for d in rd(new_doc) if d["title_ko"] in titles]
    rc, red2, _ = sandbox(R, "diff", "fix_text", "fix_stale_law_text_20260920.py",
                          args=["--dry", "--docs", ",".join(ids), "--out", "(점검)lawsync_원문대조.csv"],
                          maps=[(canon_path("doc"), new_doc)], prefixes=[(old_xml, xml)])
    notes = red_of(red2, "(점검)lawsync_원문대조.csv")
    return (rd(notes) if notes else []), {"new_doc": new_doc, "xml": xml, "ids": ids}


def texts_for(R, ctx, want):
    """옛 본문(정본 unit) · 새 본문(lawxml_units 로 새 원문 분해) — 보여 주기용."""
    LU = importlib.import_module("lawxml_units")
    ND = {d["doc_id"]: d for d in rd(ctx["new_doc"])}
    old = {}
    with io.open(canon_path("unit"), encoding="utf-8-sig", newline="") as f:
        for u in csv.DictReader(f):
            if u["doc_id"] in want:
                old[(u["doc_id"], u["unit_path"])] = u
    new = {}
    for did in want:
        d = ND.get(did)
        p = os.path.join(ctx["xml"], "LAW_%s.xml" % (d or {}).get("nlic_mst", ""))
        if not d or not os.path.exists(p):
            continue
        cp = {k[1] for k in old if k[0] == did}
        _, (info, rows, schs, memo) = LU.choose_convention(p, cp)
        for u in rows:
            new[(did, u["unit_path"])] = dict(u, _info=info)
        if memo:
            R.log("diff", "%s 분해 메모 %s" % (d["title_ko"], dict(memo)), level="정보")
    ctx["uid2path"] = {u["unit_id"]: k[1] for k, u in old.items()}
    return old, new


# ── ③ 의무 판단 ──────────────────────────────────────────────────────
KIND = [("★ 본문 바뀜", "본문 바뀜"), ("본문 바뀜", "본문 바뀜"), ("새 조문", "현행에만(새 조항호목)"), ("현행 원문에 없음", "현행에 없음(지우지 않음)")]


def judge(R, notes, ctx, docs_by_title, dc):
    DUTY = importlib.import_module("duty_predicate").DUTY
    q = []
    other = []
    title2ids = collections.defaultdict(list)
    for d in rd(ctx["new_doc"]):
        title2ids[d["title_ko"]].append(d["doc_id"])
    for n in notes:
        body = n.get("내용", "")
        k = next((v for p, v in KIND if body.startswith(p)), "")
        if not k:
            other.append(n)
            continue
        ids = title2ids.get(n["문서"], [])
        q.append({"구분": k, "doc_id": ids[0] if ids else "", "문서": n["문서"], "unit_id": n.get("unit_id/옛값", ""),
                  "unit_path": n.get("자리", ""), "조문": "", "옛 본문": "", "현행 본문": "", "_note": body})
    want = {x["doc_id"] for x in q if x["doc_id"]}
    old, new = texts_for(R, ctx, want) if want else ({}, {})
    N = importlib.import_module("lib_naming")
    for x in q:
        o = old.get((x["doc_id"], x["unit_path"]), {})
        nw = new.get((x["doc_id"], x["unit_path"]), {})
        if not x["unit_id"].startswith("UNIT-"):
            x["unit_id"] = o.get("unit_id", "")
        x["옛 본문"] = o.get("unit_text", "")
        x["현행 본문"] = nw.get("unit_text", "")
        try:
            x["조문"] = N.unit_label(N.parse_unit_path(x["unit_path"]))
        except Exception:  # noqa
            x["조문"] = x["unit_path"]
        x["_eff"] = nw.get("effective_from", "") or (nw.get("_info") or {}).get("시행일자", "")
    qpath = R.path("in/recollect_queue.csv")
    wr(qpath, q, ["구분", "doc_id", "문서", "unit_id", "unit_path", "조문", "옛 본문", "현행 본문"])
    rows = q
    if q:
        rc, red, _ = sandbox(R, "judge", "review", "report_recollect_queue_20260917.py",
                             maps=[(os.path.join(BUILD, "_recollect_queue_20260917.csv"), qpath)])
        xp = next((v for v in red.values() if v.endswith(".xlsx")), "")
        if xp and os.path.exists(xp):
            import openpyxl
            wb = openpyxl.load_workbook(xp, read_only=True)
            ws = next(s for s in wb.worksheets if s.title.startswith("전체"))
            it = ws.iter_rows(values_only=True)
            head = list(next(it))
            got = {}
            for r in it:
                d = dict(zip(head, r))
                got[(d.get("구분"), d.get("unit_path"), d.get("doc_id"))] = d
            for x in q:
                g = got.get((x["구분"], x["unit_path"], x["doc_id"]), {})
                for c in ("역할", "의무(앵커·근거)", "관리대상", "적용조건", "재검토 필요", "판정 근거"):
                    x[c] = g.get(c) or ""
            import shutil
            shutil.copyfile(xp, R.path("재검토표.xlsx"))
    # 의무 술어 · 우리 기관 의무
    by_unit = collections.defaultdict(list)
    for r in dc:
        if r.get("unit_id"):
            by_unit[r["unit_id"]].append(r)
    for x in rows:
        x["술어(현행)"] = "Y" if DUTY.search(x["현행 본문"]) else ""
        x["술어(옛)"] = "Y" if DUTY.search(x["옛 본문"]) else ""
        x["_duties"] = by_unit.get(x["unit_id"], [])
    return rows, other


def classify(rows, asof):
    """재검토표(기존 도구)의 결과를 앱이 보여 줄 갈래로 옮긴다 — 판정은 하지 않는다(모두 확인필요)."""
    art = collections.defaultdict(list)
    for x in rows:
        art[(x["doc_id"], x["unit_path"].split("/")[0])].append(x)
    for x in rows:
        has = bool(x["_duties"]) or x.get("재검토 필요") == "Y"
        sib = art[(x["doc_id"], x["unit_path"].split("/")[0])]
        sib_duty = any(s["_duties"] or s.get("재검토 필요") == "Y" for s in sib if s is not x)
        mine = bool(x["_duties"])                     # 우리 기관 의무가 걸린 조항호목
        if x["구분"] == "본문 바뀜":
            if mine:
                x["action"] = "갱신"
            elif x.get("재검토 필요") == "Y":
                x["action"] = "판정 재검토"             # 정본 판정은 붙어 있으나 우리 의무 목록에는 없는 조항 — 우리에게 새로 걸리는지 확인
            else:
                x["action"] = "신규 후보" if x["술어(현행)"] and not x["술어(옛)"] else "참고"
        elif x["구분"].startswith("현행에만"):
            if x["술어(현행)"]:
                x["action"] = "분리 후보" if sib_duty else "신규 후보"
            else:
                x["action"] = "참고"
        else:
            if has:
                x["action"] = "병합 후보" if any(s["구분"] == "본문 바뀜" for s in sib if s is not x) else "폐지 후보"
            else:
                x["action"] = "참고"
        # 기준일 규칙(사용자 09-24): 시행일이 기준일 뒤인 조문은 오늘 반영하지 않는다 — 「시행 예정」으로 따로(시행일이 되면 그날 확인에서 반영)
        eff = re.sub(r"\D", "", x.get("_eff") or "")[:8]
        if eff and eff > asof and x["action"] != "참고":
            x["_note"] = "시행 %s 예정 — %s(시행일에 반영) · %s" % (dash(eff), x["action"], x.get("_note", ""))
            x["action"] = "시행 예정"
        x["needs_human"] = "" if x["action"] in ("참고", "시행 예정") else "Y"
    return rows


# ── ④ 관리대상 연결 ──────────────────────────────────────────────────
def mapping(R, rows, dc, ctx):
    asg = rd(latest_seed("duty_assignment"))
    tasks = rd(latest_seed("compliance_task"))
    amap = rd(latest_seed("asset_target_map"))
    assets = {a["asset_id"]: a for a in rd(latest_seed("asset"))}
    by_duty = collections.defaultdict(list)
    for a in asg:
        by_duty[a["duty_key"]].append(a)
    tcount = collections.Counter(t["assign_id"] for t in tasks)
    tg_assets = collections.defaultdict(set)
    for m in amap:
        a = assets.get(m["asset_id"])
        if a and a.get("sapa_l2_result") != "제외":
            tg_assets[m["target_code"]].add(m["asset_id"])
    by_doc = collections.defaultdict(list)
    for r in dc:
        by_doc[r["doc_id"]].append(r)
    for x in rows:
        ks = [d["duty_key"] for d in x["_duties"]]
        A = [a for k in ks for a in by_duty.get(k, [])]
        x["duty_keys"] = ";".join(ks)
        x["assign_n"] = len(A)
        x["task_n"] = sum(tcount.get(a["assign_id"], 0) for a in A)
        x["depts"] = ";".join(sorted({a["dept_id"] for a in A}))
        x["tpl"] = ""
        x["prop_targets"] = x["prop_assets"] = x["prop_depts"] = ""
        if x["action"] in ("신규 후보", "분리 후보"):
            same = [d for d in by_doc.get(x["doc_id"], []) if d.get("unit_id")]
            art = x["unit_path"].split("/")[0]
            u2p = ctx.get("uid2path", {})
            near = [d for d in same if u2p.get(d["unit_id"], "").split("/")[0] == art] or same
            if near:
                t = collections.Counter((d["area"], d["target_code"]) for d in near).most_common(1)[0][0]
                tpl = next(d for d in near if (d["area"], d["target_code"]) == t)
                x["tpl"] = json.dumps({k: tpl.get(k, "") for k in ("duty_key", "area", "code36", "code36_name", "task_name", "target_code",
                                                                   "target_name", "impl_type", "impl_type_name", "law_group", "law_group_name",
                                                                   "law", "layer", "yongin_mark", "evidence_kind", "law_id")}, ensure_ascii=False)
                tg = tpl["target_code"]
                aset = tg_assets.get(tg, set())
                x["prop_targets"] = tg
                x["prop_assets"] = len(aset)
                ds = {assets[i]["dept_id"] for i in aset if i in assets}
                if not ds:                              # 기관 단위(TG24·TG26 등) — 같은 조·문서의 기존 의무를 맡은 부서
                    ds = {a["dept_id"] for d in near for a in by_duty.get(d["duty_key"], [])}
                if not ds:
                    ds = {a["dept_id"] for d in same for a in by_duty.get(d["duty_key"], [])}
                if not ds:                              # 그 법령에 배정된 부서가 아직 없다 — 총괄(중대재해예방팀)이 먼저 받아 담당 부서를 정한다
                    ds = {"D01"}
                x["prop_depts"] = ";".join(sorted(ds))
    R.log("map", "연결 — 기존 의무에 걸린 행 %d · 새 후보 %d(관리대상 제시 %d)" % (
        sum(1 for x in rows if x["duty_keys"]), sum(1 for x in rows if x["action"] in ("신규 후보", "분리 후보")),
        sum(1 for x in rows if x["prop_targets"])))
    return rows


# ── ⑤ 결과 정리 ──────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-id", default="")
    ap.add_argument("--by", default="")
    ap.add_argument("--trigger", default="화면 단추")
    ap.add_argument("--app", default="http://localhost:3400")
    ap.add_argument("--only", default="", help="제목 쉼표 — 시험용")
    ap.add_argument("--bottomup", action="store_true", help="위임 고시 역방향(lsDelegated) 전수 대조도 돈다(오래 걸림)")
    a = ap.parse_args()
    R = Run(a.run_id or None, trigger=a.trigger, by=a.by)
    rel = canon_release()
    R.status["canon_release"] = rel.get("release", "")
    R.save()
    R.log("coco", "시작 — 기준일 %s · 정본 발행판 %s(읽기만) · 우리 기관 의무 판 %s" %
          (dash(R.asof), rel.get("release", ""), os.path.basename(os.path.dirname(os.path.dirname(latest_seed("duty_class"))))))
    try:
        dc, docs, titles = our_docs()
        if a.only:
            titles = {t for t in titles if t in set(a.only.split(","))}
        stat_titles = {d["title_ko"] for d in docs if d["legacy_layer"] in LAYERS and (d.get("nlic_mst") or "").strip()}
        admin_docs, seen = [], set()
        for d in docs:
            if d["title_ko"] in titles and d["title_ko"] not in stat_titles and d.get("norm_category") == "admin_rule" and d["title_ko"] not in seen:
                seen.add(d["title_ko"])
                admin_docs.append(d)
        # ① 법령·고시 감시를 동시에(두 하위 작업자)
        R.step("watch", "진행 중")
        R.log("watch", "관계법령 %d건 확인 시작 — 법령 %d(판 목록 전체 %d) · 행정규칙 %d" %
              (len(titles), len(titles & stat_titles), len(stat_titles), len(admin_docs)))
        with cf.ThreadPoolExecutor(max_workers=2) as ex:
            f1 = ex.submit(watch_law, R, stat_titles if not a.only else (titles & stat_titles))
            f2 = ex.submit(watch_admin, R, admin_docs)
            law_rows, _day = f1.result()
            adm_rows = f2.result()
        mine = [r for r in law_rows if r["문서"] in titles]
        applied = jload(APPLIED, {})
        stale, overlap = [], []
        for r in mine:
            m = re.search(r"현행 (\d+) 시행 (\d+)", r["판정"])
            if r["판정"].startswith("정본이 낡은"):
                if m and applied.get(r["문서"]) == m.group(1):
                    r["판정"] = "반영됨(앞 확인) — " + r["판정"]
                else:
                    stale.append(r)
            elif r["판정"].startswith("★"):
                sig = r.get("판 목록", "")
                if applied.get("겹침:" + r["문서"]) == sig:
                    r["판정"] = "확인함(앞 확인 · 판 목록 그대로) — " + r["판정"]
                else:
                    overlap.append(r)
        wr(R.path("watch_law.csv"), mine)
        adm_changed = [r for r in adm_rows if r["판정"].startswith("개정됨")]
        cnt = collections.Counter(r["판정"].split("(")[0].split(" —")[0] for r in mine)
        R.step("watch", "완료", note="법령 %d(개정 %d · 판 겹침 %d) · 행정규칙 %d(개정 %d · 처음 기록 %d)" % (
            len(mine), len(stale), len(overlap), len(adm_rows), len(adm_changed), sum(1 for r in adm_rows if r["판정"].startswith("기준 기록"))))
        R.log("watch", "감시 끝 — 법령 " + ", ".join("%s %d" % kv for kv in cnt.items()), level="발견" if stale or overlap else "정보")
        for r in stale:
            R.log("watch", "개정 발견 %s — %s" % (r["문서"], r["판정"]), level="발견")
        for r in adm_changed:
            R.log("watch", "행정규칙 개정 %s — %s" % (r["문서"], r["판정"]), level="발견")
        # ② 원문 대조
        R.step("diff", "진행 중", total=len(stale))
        notes, ctx = diff_law(R, stale, docs)
        R.step("diff", "완료", done=len(stale), note="조항호목 변경 %d줄" % len(notes))
        # ③ 의무 판단
        R.step("judge", "진행 중")
        rows, other = judge(R, notes, ctx, None, dc) if notes else ([], [])
        rows = classify(rows, R.asof)
        rc, _, gl = sandbox(R, "judge", "lessons", "audit_lesson_guard.py")
        lesson = [x for x in gl if "교훈" in x and ("강제" in x or "문서뿐" in x)]
        R.status["lessons"] = {"요약": lesson[-1] if lesson else "", "적용": [
            "E74 원문 현행성 — 판 목록(diag_version_overlap) · 판 겹침은 자동으로 덮지 않음(fix_stale_law_text)",
            "E66 발행판만 읽기 — 정본 _RELEASE.json 이 가리키는 판",
            "E69 의무 술어 계측기(duty_predicate) — 새 조문을 의무 후보로",
            "원칙 4 자동 대량 판정 금지 — 판정은 하지 않고 확인필요로",
            "원칙 5 원문=사실 · 판단층=재검토 — 본문 바뀐 조항의 판정은 재검토표(report_recollect_queue)",
            "E61·원칙 9 위임 고시 역방향 — lsDelegated 전수 대조는 --bottomup(주간)"]}
        acnt = collections.Counter(x["action"] for x in rows)
        R.step("judge", "완료", note=" · ".join("%s %d" % kv for kv in acnt.most_common()))
        R.log("judge", "판단 갈래 — " + ", ".join("%s %d" % kv for kv in acnt.most_common()))
        # ④ 관리대상 연결
        R.step("map", "진행 중")
        rows = mapping(R, rows, dc, ctx)
        R.step("map", "완료", note="의무 걸린 변경 %d · 새 후보 연결 %d" % (sum(1 for x in rows if x["duty_keys"]),
                                                                  sum(1 for x in rows if x.get("prop_targets"))))
        # 위임 고시 역방향(선택)
        if a.bottomup:
            sandbox(R, "watch", "bottomup", "audit_delegated_admrule.py")
        # ⑤ 결과 정리
        R.step("report", "진행 중")
        items = []
        for i, x in enumerate(rows, 1):
            items.append({"item_id": "%s-%04d" % (R.id, i), "run_id": R.id, "kind": "법령", "doc_id": x["doc_id"], "title": x["문서"],
                          "unit_id": x["unit_id"], "unit_path": x["unit_path"], "label": x["조문"], "change": x["구분"],
                          "action": x["action"], "needs_human": x["needs_human"], "predicate": x["술어(현행)"],
                          "role": x.get("역할", ""), "obligations": x.get("의무(앵커·근거)", ""), "review": x.get("재검토 필요", ""),
                          "old_text": x["옛 본문"], "new_text": x["현행 본문"], "effective": x.get("_eff", ""),
                          "duty_keys": x["duty_keys"], "assign_n": x["assign_n"], "task_n": x["task_n"], "depts": x["depts"],
                          "prop_targets": x.get("prop_targets", ""), "prop_assets": x.get("prop_assets", ""), "prop_depts": x.get("prop_depts", ""),
                          "tpl": x.get("tpl", ""), "note": x.get("_note", "")})
        k = len(items)
        for r in overlap:
            k += 1
            items.append({"item_id": "%s-%04d" % (R.id, k), "run_id": R.id, "kind": "판 겹침", "doc_id": r["doc_id"], "title": r["문서"],
                          "change": "판 겹침", "action": "판 겹침 확인", "needs_human": "Y",
                          "note": "지금 효력인 본문이 한 판에 없다 — 기준일 규칙(시행일 ≤ 기준일 판 중 조문별 공포일 최신)으로 조문별 확인. 판 목록: " + r.get("판 목록", "")})
        for r in adm_changed:
            k += 1
            items.append({"item_id": "%s-%04d" % (R.id, k), "run_id": R.id, "kind": "행정규칙", "doc_id": r["doc_id"], "title": r["문서"],
                          "change": "행정규칙 개정", "action": "고시 개정 확인", "needs_human": "Y", "effective": r["현행 시행"],
                          "note": r["판정"] + " · 현행 일련번호 " + r["현행 일련번호"]})
        for n in other:
            if n.get("내용", "").startswith("★") or "별표" in n.get("내용", ""):
                k += 1
                items.append({"item_id": "%s-%04d" % (R.id, k), "run_id": R.id, "kind": "별표·기타", "title": n["문서"],
                              "unit_path": n.get("자리", ""), "change": "별표·기타", "action": "참고", "needs_human": "",
                              "note": n.get("내용", "")})
        cols = ["item_id", "run_id", "kind", "doc_id", "title", "unit_id", "unit_path", "label", "change", "action", "needs_human", "predicate",
                "role", "obligations", "review", "old_text", "new_text", "effective", "duty_keys", "assign_n", "task_n", "depts",
                "prop_targets", "prop_assets", "prop_depts", "tpl", "note"]
        wr(R.path("items.csv"), items, cols)
        # 개정 현황(law_change) — 문서 단위
        lc = []
        by_t = collections.defaultdict(list)
        for it in items:
            by_t[it["title"]].append(it)
        law_of = {d["title_ko"]: d for d in docs}
        lawn = {l["law_id"]: l.get("title_ko") or l.get("law_name") or "" for l in rd(canon_path("law"))}
        for j, (t, its) in enumerate(sorted(by_t.items()), 1):
            d = law_of.get(t, {})
            src = next((r for r in stale + overlap if r["문서"] == t), None)
            m = re.search(r"현행 (\d+) 시행 (\d+)", (src or {}).get("판정", ""))
            prom = re.search(r"\(공포 (\d+)\)", (src or {}).get("가장 늦은 시행", ""))
            adm = next((r for r in adm_changed if r["문서"] == t), None)
            keys = {k2 for it in its for k2 in (it.get("duty_keys") or "").split(";") if k2}
            human = sum(1 for it in its if it.get("needs_human") == "Y")
            lc.append({"change_id": "LCH-%s-%02d" % (R.id[4:], j), "law": lawn.get(d.get("law_id", ""), "") or t, "doc": t,
                       "changed_kind": "판 겹침" if any(it["kind"] == "판 겹침" for it in its) else ((adm or {}).get("개정 구분") or "개정"),
                       "promulgated_at": dash((prom.group(1) if prom else "") or (adm or {}).get("현행 발령", "")),
                       "effective_at": dash((m.group(2) if m else "") or (adm or {}).get("현행 시행", "")),
                       "affected_duty_cnt": len(keys), "notice_sent_at": "", "note": "법제처 확인 %s" % dash(R.asof),
                       "run_id": R.id, "status": "담당 확인 중" if human else "반영됨", "new_mst": m.group(1) if m else "",
                       "changed_units": sum(1 for it in its if it["change"] == "본문 바뀜"),
                       "new_units": sum(1 for it in its if it["change"].startswith("현행에만")),
                       "removed_units": sum(1 for it in its if it["change"].startswith("현행에 없음")), "human_items": human})
        wr(R.path("law_change.csv"), lc, ["change_id", "law", "doc", "changed_kind", "promulgated_at", "effective_at", "affected_duty_cnt",
                                          "notice_sent_at", "note", "run_id", "status", "new_mst", "changed_units", "new_units",
                                          "removed_units", "human_items"])
        for r in stale:
            m = re.search(r"현행 (\d+) 시행 (\d+)", r["판정"])
            if m:
                applied[r["문서"]] = m.group(1)
        for r in overlap:
            applied["겹침:" + r["문서"]] = r.get("판 목록", "")
        jsave(APPLIED, applied)
        R.status["summary"] = {"관계법령": len(titles), "법령": len(mine), "행정규칙": len(adm_rows), "개정 법령": len(stale),
                               "판 겹침": len(overlap), "개정 행정규칙": len(adm_changed), "변경 조항호목": len(rows),
                               "사람 확인": sum(1 for it in items if it.get("needs_human") == "Y"),
                               "갈래": dict(acnt), "개정 현황": len(lc)}
        R.step("report", "완료", note="개정 현황 %d · 판단 항목 %d(사람 확인 %d)" % (len(lc), len(items), R.status["summary"]["사람 확인"]))
        R.status["state"] = "완료"
        R.status["ended_at"] = now()
        R.save()
        R.log("coco", "끝 — 개정 현황 %d · 판단 항목 %d · 사람 확인 %d" % (len(lc), len(items), R.status["summary"]["사람 확인"]), level="완료")
        try:
            req = urllib.request.Request(a.app.rstrip("/") + "/api/lawsync/apply", data=json.dumps({"run_id": R.id}).encode("utf-8"),
                                         headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=60) as resp:
                R.log("report", "앱 반영 요청 — %s" % resp.read().decode("utf-8", "replace")[:200])
        except Exception as e:  # noqa
            R.log("report", "앱 반영 요청 실패(앱이 꺼져 있으면 관리 화면에서 「반영」으로 다시 한다) — %s" % str(e)[:80], level="경고")
    except Exception as e:  # noqa
        import traceback
        R.status["state"] = "실패"
        R.status["ended_at"] = now()
        R.save()
        R.log("coco", "실패 — %s" % e, level="오류", trace=traceback.format_exc()[-1500:])
        raise


if __name__ == "__main__":
    main()
