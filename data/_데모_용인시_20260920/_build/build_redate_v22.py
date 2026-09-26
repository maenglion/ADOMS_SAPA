# -*- coding: utf-8 -*-
r"""
ops_v2.2_20260924 — 예시 과제의 기한·반기를 현실적으로 다시 놓는다(2026-09-24). 앞 판 그대로 · 이미 있으면 멈춘다.

사용자: 「상반기 84.19%인데 하반기 3개월이 지난 시점에 이행률이 상반기와 비슷한 것은 납득이 안 간다」
원인(실측): ① 반기 칸(task_approval_patch.half_year)이 기한과 따로 놀았다 — 「상반기」 903건 중 기한이 1~6월인 것은 146건
          ② 기한이 10~12월인데 이미 「이행완료」인 과제 190건이 하반기 이행률을 끌어올렸다 ③ 기한이 2027년까지 퍼져 있었다
규칙(과제 상태·결재 상태·증빙은 바꾸지 않는다 — 날짜만 다시 놓는다 · 과제 번호의 해시로 정해 다시 돌려도 같다)
  영역(I·F·M)마다
    · 목표 이행률 상반기 약 90% · 하반기(지난 부분 7/1~9/20) 약 78% 가 되도록 완료·문제(조치필요·기간초과) 과제를 두 반기에 나눈다
      (완료가 모자라는 영역은 상반기에 완료의 30% 이상 · 문제 과제의 3분의 1 이상은 하반기)
    · 대기 과제의 2% 만큼은 「미리 완료」(기한은 앞으로 · 완료일은 9월 중)
    · 대기 과제 = 앞으로(9/26~12/28)
  딸린 날짜: 완료일 = 기한 1~10일 전 · 제출 = 완료일 · 부서장 확인 = 제출+1 · 승인 = 제출+3 · 반려 = 제출+2 · 만든 날 = 기한-45 ·
            계획일 = 기한-5 · 반기 = 기한의 달 · 증빙 올린 날 = 완료일 · 점검일 = 승인일(없으면 완료일+3) · 기한초과 알림 = 기한+3(문구의 기한·경과일도)
  오늘(2026-09-24) 이후 날짜는 만들지 않는다(완료·결재·점검·알림).
바뀐 칸 → ops_v2.2_20260924\_redate_log.csv
"""
import csv, datetime as dt, hashlib, io, os, re, sys, collections as C
csv.field_size_limit(10**9)
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
V = os.path.join(DEMO, "ops_v2.2_20260924"); OUT = os.path.join(V, "seed")
TODAY = dt.date(2026, 9, 24)
LAST = TODAY - dt.timedelta(days=1)


def latest(t):
    ds = sorted((d for d in os.listdir(DEMO) if d.startswith("ops_") and d != "ops_v2.2_20260924"),
                key=lambda d: [int(x) for x in d.split("_")[1][1:].split(".")])
    for d in reversed(ds):
        p = os.path.join(DEMO, d, "seed", t + ".csv")
        if os.path.exists(p):
            return p


def read(t):
    with io.open(latest(t), encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        return list(r.fieldnames), list(r)


def write(t, cols, rows):
    with io.open(os.path.join(OUT, t + ".csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)


def h(s, n):
    return int(hashlib.sha1(s.encode("utf-8")).hexdigest()[:8], 16) % n


def pick(tid, a, b):
    """a~b 사이 날짜 하나(과제 번호로 정해짐)"""
    span = (b - a).days
    return a + dt.timedelta(days=h(tid, span + 1))


D = lambda s: dt.date.fromisoformat(s) if s else None
S = lambda d: d.isoformat() if d else ""
cap = lambda d: min(d, LAST) if d else d

if os.path.exists(V):
    sys.exit("이미 있다 — 덮어쓰지 않는다: " + V)
log = []


def ch(t, k, c, o, n):
    if o != n:
        log.append({"table": t, "key": k, "col": c, "old": o, "new": n})


ct, T = read("compliance_task")
cp, P = read("task_approval_patch")
PB = {p["task_id"]: p for p in P}
_, A = read("duty_assignment")
AB = {a["assign_id"]: a for a in A}
_, DC = read("duty_class")
DB = {d["duty_key"]: d for d in DC}
area = lambda t: DB.get(AB[t["assign_id"]]["duty_key"], {}).get("area", "?")

DONE, BAD = ("이행완료", "점검완료"), ("조치필요", "기간초과")
H1 = (dt.date(2026, 1, 10), dt.date(2026, 6, 30))
H2P = (dt.date(2026, 7, 1), dt.date(2026, 9, 20))
FUT = (dt.date(2026, 9, 26), dt.date(2026, 12, 28))
slot = {}
for ar in sorted({area(t) for t in T}):
    ts = sorted((t for t in T if area(t) == ar), key=lambda t: h(t["task_id"], 10**9))
    bad = [t for t in ts if t["status"] in BAD]
    done = [t for t in ts if t["status"] in DONE]
    wait = [t for t in ts if t["status"] not in DONE + BAD]
    # 목표 이행률 상반기 약 90%(완료 = 문제 × 9) · 하반기 약 78%(완료 = 문제 × 3.5)가 되도록 문제 과제를 두 반기에 나눈다.
    # 완료 과제가 모자라는 영역(원료·제조물 등)은 상반기에 완료의 30% 이상을 두고 그 비율에 맞춰 문제를 나눈다.
    early = min(len(done), round(len(wait) * 0.02))
    dn, bn = len(done) - early, len(bad)
    b1 = max(0, min(bn, round((dn - 3.5 * bn) / 5.5)))
    d1 = min(dn, max(round(9 * b1), round(0.3 * dn)))
    b1 = min(bn - (bn + 2) // 3, max(b1, round(d1 / 9)))   # 문제 과제의 3분의 1 이상은 하반기에 남긴다
    for i, t in enumerate(bad):
        slot[t["task_id"]] = "H1" if i < b1 else "H2P"
    for i, t in enumerate(done):
        slot[t["task_id"]] = "H1" if i < d1 else ("EARLY" if i < d1 + early else "H2P")
    for t in wait:
        slot[t["task_id"]] = "FUT"

new_due, new_done = {}, {}
for t in T:
    tid, s = t["task_id"], slot[t["task_id"]]
    rng = {"H1": H1, "H2P": H2P, "FUT": FUT, "EARLY": FUT}[s]
    due = pick(tid, *rng)
    if s == "EARLY":
        done = pick(tid + "e", dt.date(2026, 9, 1), LAST)
    elif t["status"] in DONE or t["status"] == "조치필요":
        done = cap(due - dt.timedelta(days=1 + h(tid + "d", 10)))
    else:
        done = None
    new_due[tid], new_done[tid] = due, done
    ch("compliance_task", tid, "due_date", t["due_date"], S(due)); t["due_date"] = S(due)
    nd = S(done) if t.get("done_at") or done else ""
    if t["status"] == "기간초과" or t["status"] == "이행대기":
        nd = ""
    ch("compliance_task", tid, "done_at", t["done_at"], nd); t["done_at"] = nd

for p in P:
    tid = p["task_id"]
    if tid not in new_due:
        continue
    due, done = new_due[tid], new_done[tid]
    st = p["approval_status"]
    upd = {"period_year": "2026", "half_year": "상반기" if due.month <= 6 else "하반기",
           "created_at": S(max(dt.date(2026, 1, 2), min(due - dt.timedelta(days=45), LAST))), "plan_date": S(due - dt.timedelta(days=5))}
    if st in ("제출", "승인", "반려") and done:
        sub = done
        upd["submitted_at"] = S(sub)
        if p.get("head_ok_at"):
            upd["head_ok_at"] = S(cap(sub + dt.timedelta(days=1)))
        if st == "승인":
            upd["approved_at"] = S(cap(sub + dt.timedelta(days=3)))
        if st == "반려":
            upd["rejected_at"] = S(cap(sub + dt.timedelta(days=2)))
    for k, v in upd.items():
        if k in p:
            ch("task_approval_patch", tid, k, p[k], v)
            p[k] = v

ce, EV = read("evidence")
for e in EV:
    d = new_done.get(e["task_id"])
    if d:
        ch("evidence", e["evidence_id"], "uploaded_at", e["uploaded_at"], S(d)); e["uploaded_at"] = S(d)
ci, INS = read("inspection")
for x in INS:
    p = PB.get(x["task_id"], {})
    d = D(p.get("approved_at")) or (new_done.get(x["task_id"]) and cap(new_done[x["task_id"]] + dt.timedelta(days=3)))
    if d:
        ch("inspection", x["insp_id"], "insp_date", x["insp_date"], S(d)); x["insp_date"] = S(d)
cn, NT = read("notification")
for n in NT:
    if n.get("notif_type") == "기한초과" and n["task_id"] in new_due:
        due = new_due[n["task_id"]]
        if due >= TODAY:
            continue
        sent = cap(due + dt.timedelta(days=3))
        msg = re.sub(r"기한 \d{4}-\d{2}-\d{2} \(\d+일 경과\)", "기한 %s (%d일 경과)" % (S(due), (TODAY - due).days), n["message"])
        ch("notification", n["notif_id"], "sent_at", n["sent_at"], S(sent)); n["sent_at"] = S(sent)
        ch("notification", n["notif_id"], "message", n["message"], msg); n["message"] = msg

os.makedirs(OUT)
write("compliance_task", ct, T)
write("task_approval_patch", cp, P)
write("evidence", ce, EV)
write("inspection", ci, INS)
write("notification", cn, NT)
with io.open(os.path.join(V, "_redate_log.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["table", "key", "col", "old", "new"])
    w.writeheader()
    w.writerows(log)

# 검산 — 영역별 반기 이행률(대시보드와 같은 규칙: 기한 지난 것 + 완료, 대기·기한 전 제외)
def mark(t):
    s = t["status"]
    if s in DONE: return "O"
    if s == "조치필요": return "T"
    if s == "기간초과": return "X"
    return "X" if t["due_date"] < S(TODAY) else "W"
for ar in sorted({area(t) for t in T}):
    for hf in ("상반기", "하반기"):
        c = C.Counter(mark(t) for t in T if area(t) == ar and PB[t["task_id"]]["half_year"] == hf)
        den = c["O"] + c["T"] + c["X"]
        print(ar, hf, dict(c), "이행률 %.1f%%" % (100.0 * c["O"] / den if den else 0), "진행률 %.1f%%" % (100.0 * c["O"] / (den + c["W"]) if den + c["W"] else 0))
print("미래 완료일", sum(1 for t in T if t["done_at"] and t["done_at"] > S(TODAY)), "· 2027 기한", sum(1 for t in T if t["due_date"] >= "2027"), "· 바뀐 칸", len(log))
