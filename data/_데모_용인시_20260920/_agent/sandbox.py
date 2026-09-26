# -*- coding: utf-8 -*-
r"""
격리 실행기 — 정본 파이프라인의 기존 스크립트를 **한 줄도 고치지 않고** 그대로 돌린다(2026-09-24).

왜 필요한가
  기존 스크립트(diag_version_overlap · fix_stale_mst · fix_stale_law_text · report_recollect_queue · audit_lesson_guard …)는
  시행착오를 거쳐 교훈이 들어 있는 코드다(사용자 09-24: 새로 짜면 같은 오류가 난다). 그러나 출력·입력 경로가
  정본 폴더(build · master · _정본미확보목록 · lawxml_*)에 박혀 있다. 이 앱은 정본을 **읽기만** 해야 한다.
  그래서 스크립트를 이 실행기 안에서 돌리고, 파일 열기만 가로챈다.

하는 일 (자식 프로세스 하나 = 하위 작업자 하나)
  · 쓰기 가로채기 — 보호 폴더(ADOMS_DB_v1 전체 · lawxml_*) 안으로 가는 쓰기(open w/a/x · os.replace · shutil.copy*)는
    실행 폴더 run\_out\<이름>\ 로 돌린다. 같은 프로세스에서 그 파일을 다시 읽으면 돌린 쪽을 읽는다.
  · 삭제 막기 — 보호 폴더 안의 os.remove · unlink 는 하지 않고 기록만 한다.
  · 입력 바꿔 끼우기 — --map 원래경로=>새경로(파일) · --prefix 원래폴더=>새폴더(폴더 통째, 읽기·쓰기 모두)
    예) 판 목록 캐시 _eflaw_cache_20260920 → 오늘 날짜 캐시(옛 캐시로 판단하지 않게)
  · 무엇을 돌렸는지 run\_out\<이름>\_redirect.json 에 남긴다(감사 기록).
사용
  python sandbox.py --script <경로> --run <실행폴더> --name <이름> [--map A=>B ...] [--prefix A=>B ...] -- <스크립트 인자>
"""
import argparse, builtins, io, json, os, runpy, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
DB = os.path.dirname(DEMO)                     # ADOMS_DB_v1
COLLECT = os.path.dirname(DB)                  # _수집작업 (lawxml_* 들이 여기 있다)


def N(p):
    return os.path.normcase(os.path.abspath(p))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True)
    ap.add_argument("--run", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--map", action="append", default=[])
    ap.add_argument("--prefix", action="append", default=[])
    ap.add_argument("rest", nargs=argparse.REMAINDER)
    a = ap.parse_args()
    out = os.path.join(a.run, "_out", a.name)
    os.makedirs(out, exist_ok=True)
    LAWSYNC = N(os.path.join(DEMO, "law_sync"))
    PROTECT = [N(DB), N(os.path.join(COLLECT, "lawxml")), N(COLLECT)]
    FMAP = {N(x.split("=>")[0]): os.path.abspath(x.split("=>")[1]) for x in a.map}
    PMAP = [(N(x.split("=>")[0]), os.path.abspath(x.split("=>")[1])) for x in a.prefix]
    red, blocked, reads = {}, [], []
    _open, _replace, _rename, _copy2, _copyfile, _remove, _unlink = (builtins.open, os.replace, os.rename, shutil.copy2,
                                                                   shutil.copyfile, os.remove, os.unlink)
    _exists, _getsize, _isfile, _makedirs = os.path.exists, os.path.getsize, os.path.isfile, os.makedirs

    def mapped(p):
        if not isinstance(p, (str, bytes, os.PathLike)):
            return p
        p = os.fspath(p)
        if isinstance(p, bytes):
            return p
        n = N(p)
        if n in red:
            return red[n]
        if n in FMAP:
            return FMAP[n]
        for src, dst in PMAP:
            if n == src or n.startswith(src + os.sep):
                return os.path.join(dst, os.path.relpath(n, src))
        return p

    def guarded(p):
        n = N(p)
        if n.startswith(LAWSYNC + os.sep) or n.startswith(N(a.run) + os.sep):
            return False
        return any(n == r or n.startswith(r + os.sep) for r in PROTECT)

    def w_target(p):
        m = mapped(p)
        if m is not p and N(m) != N(p) and not guarded(m):
            os.makedirs(os.path.dirname(m), exist_ok=True)
            return m
        if guarded(m):
            n = N(p)
            if n not in red:
                base = os.path.basename(m)
                t, i = os.path.join(out, base), 1
                while t in red.values():
                    t = os.path.join(out, "%d_%s" % (i, base))
                    i += 1
                red[n] = t
            return red[n]
        return m

    def h_open(file, mode="r", *args, **kw):
        if isinstance(file, int):
            return _open(file, mode, *args, **kw)
        if any(c in mode for c in "wax+"):
            src = os.fspath(file)
            fresh = N(src) not in red
            t = w_target(file)
            if "a" in mode and fresh and N(t) != N(src) and not _exists(t) and _exists(src):
                with _open(src, "rb") as fi, _open(t, "wb") as fo:   # 덧붙이기면 원본을 먼저 복사해 두고 거기에 붙인다(원본은 그대로)
                    fo.write(fi.read())
            return _open(t, mode, *args, **kw)
        m = mapped(file)
        if m is not file and isinstance(m, str) and N(m) != N(os.fspath(file)):
            reads.append([os.fspath(file), m])
        return _open(m, mode, *args, **kw)

    def h_replace(src, dst, *x, **k):
        return _replace(mapped(src), w_target(dst))

    def h_rename(src, dst, *x, **k):
        return _rename(mapped(src), w_target(dst))

    def h_copy2(src, dst, *x, **k):
        return _copy2(mapped(src), w_target(dst))

    def h_copyfile(src, dst, *x, **k):
        return _copyfile(mapped(src), w_target(dst))

    def h_remove(p, *x, **k):
        if guarded(mapped(p)):
            blocked.append(os.fspath(p))
            return None
        return _remove(mapped(p))

    def h_makedirs(p, *x, **k):
        m = mapped(p)
        if guarded(m) and not _exists(m):
            blocked.append("makedirs " + os.fspath(p))
            return None
        return _makedirs(m, *x, **k)

    builtins.open = h_open
    io.open = h_open
    os.replace, os.rename, os.remove, os.unlink = h_replace, h_rename, h_remove, h_remove
    shutil.copy2, shutil.copyfile = h_copy2, h_copyfile
    os.makedirs = h_makedirs
    os.path.exists = lambda p: _exists(mapped(p))
    os.path.isfile = lambda p: _isfile(mapped(p))
    os.path.getsize = lambda p: _getsize(mapped(p))

    rest = a.rest[1:] if a.rest and a.rest[0] == "--" else a.rest
    sys.argv = [a.script] + rest
    sys.path.insert(0, os.path.dirname(os.path.abspath(a.script)))
    code = 0
    try:
        runpy.run_path(a.script, run_name="__main__")
    except SystemExit as e:
        code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
        if not isinstance(e.code, int) and e.code:
            print(str(e.code))
    finally:
        builtins.open, io.open = _open, _open
        rec = {"script": a.script, "argv": rest, "exit": code,
               "redirected_writes": {k: v for k, v in red.items()}, "mapped_reads": reads[:200], "blocked": blocked}
        with _open(os.path.join(out, "_redirect.json"), "w", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False, indent=1))
    sys.exit(code)


if __name__ == "__main__":
    main()
