# -*- coding: utf-8 -*-
r"""
체크리스트 생성 작업(CoCo) 공용 부품 — 경로 · 기록 · 법제처 호출 · CSV (2026-09-24).

구조 (코드 _agent\ · 산출 law_sync\)
  coco.py        총괄(오케스트레이터) — 하위 작업자를 차례·병렬로 부르고 상태·기록을 남긴다
  ag_watch.py    ① 개정 감시   — 관계법령 목록 전체를 법제처에서 조회해 판이 바뀐 문서를 찾는다
  ag_diff.py     ② 원문 대조   — 바뀐 문서의 새 원문을 받아 조항호목으로 쪼개 기준 원문과 맞댄다
  ag_judge.py    ③ 의무 판단   — 정본과 같은 규칙(의무 술어 계측기 · 판정 규칙 v1.3 · 오류교훈)으로 신규·갱신·폐지·분리·병합을 가린다
  ag_map.py      ④ 관리대상 연결 — 용인시 관리대상·부서·배정에 잇는다
  (coco.py 안)   ⑤ 결과 정리   — 개정 현황 · 판단 항목 · 요약을 쓰고 앱에 반영을 요청한다

지키는 것
  · 정본(ADOMS_DB_v1\build)과 발행된 데모 판(ops_* · us_* · base_*)은 **읽기만** 한다.
  · 판단은 1차 자동 판단이고, 문구만 바뀐 갱신 말고는 **모두 사람 확인**(확인필요)으로 넘긴다(원칙 4).
  · 산출은 law_sync\runs\RUN-… 에 새로 쓰고, 앱 반영은 앱이 한다(쓰는 곳 하나 — 앱의 공용 쓰기 경로).
"""
import csv, datetime, hashlib, io, json, os, re, sys, threading, time, urllib.parse, urllib.request

csv.field_size_limit(2 ** 31 - 1)
HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)                                   # _데모_용인시_20260920
DB = os.path.dirname(DEMO)                                     # ADOMS_DB_v1
BUILD = os.path.join(DB, "build")
SCRIPT = os.path.join(DB, "script")
LS = os.path.join(DEMO, "law_sync")
RUNS = os.path.join(LS, "runs")
STATE = os.path.join(LS, "_state")
CACHE = os.path.join(LS, "_cache")
OC = "adoms"
for d in (RUNS, STATE, CACHE):
    os.makedirs(d, exist_ok=True)
if SCRIPT not in sys.path:
    sys.path.insert(0, SCRIPT)

AGENTS = {
    "coco": "CoCo 총괄",
    "watch": "① 개정 감시",
    "diff": "② 원문 대조",
    "judge": "③ 의무 판단",
    "map": "④ 관리대상 연결",
    "report": "⑤ 결과 정리",
}


def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def ymd(d=None):
    return (d or datetime.date.today()).strftime("%Y%m%d")


def dash(s):
    s = (s or "").strip()
    return "%s-%s-%s" % (s[:4], s[4:6], s[6:8]) if re.fullmatch(r"\d{8}", s) else s


# ── CSV ──────────────────────────────────────────────────────────────
def rd(path):
    with io.open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def wr(path, rows, cols=None):
    cols = cols or (list(rows[0].keys()) if rows else ["empty"])
    with io.open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def latest_seed(table):
    """앱이 읽는 것과 같은 규칙 — ops_* 판을 새것부터(발행판 읽기만)."""
    for d in sorted((x for x in os.listdir(DEMO) if x.startswith("ops_")), reverse=True):
        p = os.path.join(DEMO, d, "seed", table + ".csv")
        if os.path.exists(p):
            return p
    return None


def canon_release():
    m = json.load(io.open(os.path.join(BUILD, "_RELEASE.json"), encoding="utf-8"))
    return m


def canon_path(table):
    m = canon_release()
    return os.path.join(BUILD, m["tables"][table]["file"])


# ── 실행(run) 기록 ─────────────────────────────────────────────────────
class Run(object):
    """한 번의 실행 — 상태(status.json) · 기록(log.jsonl) · 산출 파일 자리."""

    def __init__(self, run_id=None, asof=None, trigger="화면 단추", by=""):
        self.id = run_id or "RUN-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        self.dir = os.path.join(RUNS, self.id)
        os.makedirs(self.dir, exist_ok=True)
        self.asof = asof or ymd()
        self._lk = threading.Lock()
        self.status = {"run_id": self.id, "asof": dash(self.asof), "trigger": trigger, "by": by,
                       "started_at": now(), "ended_at": "", "state": "진행 중", "canon_release": "",
                       "steps": [{"key": k, "name": v, "state": "대기", "started_at": "", "ended_at": "", "note": "", "done": 0, "total": 0}
                                 for k, v in AGENTS.items() if k != "coco"],
                       "summary": {}}
        self.save()

    def path(self, name):
        return os.path.join(self.dir, name)

    def save(self):
        with self._lk:
            tmp = self.path("status.json.tmp")
            io.open(tmp, "w", encoding="utf-8").write(json.dumps(self.status, ensure_ascii=False, indent=1))
            os.replace(tmp, self.path("status.json"))

    def log(self, agent, msg, level="정보", **data):
        rec = {"at": now(), "agent": agent, "name": AGENTS.get(agent, agent), "level": level, "msg": msg}
        if data:
            rec["data"] = data
        with self._lk:
            with io.open(self.path("log.jsonl"), "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print("[%s] %s %s" % (rec["at"][11:], rec["name"], msg), flush=True)

    def step(self, key, state=None, note=None, done=None, total=None):
        for s in self.status["steps"]:
            if s["key"] == key:
                if state:
                    if state == "진행 중" and not s["started_at"]:
                        s["started_at"] = now()
                    if state in ("완료", "실패", "건너뜀"):
                        s["ended_at"] = now()
                    s["state"] = state
                if note is not None:
                    s["note"] = note
                if done is not None:
                    s["done"] = done
                if total is not None:
                    s["total"] = total
        self.save()


# ── 법제처 OPEN API (OC=adoms) — 날마다 캐시(같은 날 다시 눌러도 빠르다) ──────
_api_lk = threading.Lock()
_last = [0.0]


def api(endpoint, params, day_cache=True, timeout=90):
    q = dict(params)
    q["OC"] = OC
    url = "http://www.law.go.kr/DRF/%s?%s" % (endpoint, urllib.parse.urlencode(q))
    key = hashlib.sha1(url.encode("utf-8")).hexdigest()[:20]
    cdir = os.path.join(CACHE, ymd() if day_cache else "fixed")
    os.makedirs(cdir, exist_ok=True)
    f = os.path.join(cdir, key + ".xml")
    if os.path.exists(f) and os.path.getsize(f) > 200:
        return io.open(f, encoding="utf-8").read()
    err = None
    for i in range(3):
        with _api_lk:                       # 초당 호출을 낮게 — 공공 API 예의
            wait = 0.12 - (time.time() - _last[0])
            if wait > 0:
                time.sleep(wait)
            _last[0] = time.time()
        try:
            with urllib.request.urlopen(url, timeout=timeout) as r:
                y = r.read().decode("utf-8", "replace")
            io.open(f, "w", encoding="utf-8").write(y)
            return y
        except Exception as e:  # noqa
            err = e
            time.sleep(2 + 3 * i)
    raise err


def tag(block, k):
    m = re.search(r"<%s>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</%s>" % (k, k), block, re.S)
    return m.group(1).strip() if m else ""


def norm(t):
    """비교용 — 개정 표시(<개정 …>·[본조신설 …])와 공백을 걷는다. 원문 자체는 바꾸지 않는다."""
    t = re.sub(r"<[^<>]{0,80}>", "", t or "")
    t = re.sub(r"\[[^\[\]]{0,40}(신설|개정|전문개정|이동|삭제)[^\[\]]{0,40}\]", "", t)
    return re.sub(r"\s+", "", t)


AMEND_RX = re.compile(r"(개정|신설|삭제|본조신설|전문개정)[^<>\[\]]{0,40}?(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.")


def amend_dates(t):
    return {"%s%02d%02d" % (m.group(2), int(m.group(3)), int(m.group(4))) for m in AMEND_RX.finditer(t or "")}
