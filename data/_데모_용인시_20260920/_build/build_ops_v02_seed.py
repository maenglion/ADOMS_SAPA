# -*- coding: utf-8 -*-
r"""ops_v0.2 시드 — 참고 명세에 있는데 우리에게 없던 표를 **시연용 예시 데이터**로 채운다.

    python build_ops_v02_seed.py v0.2

규칙
  · 실제 기록이 아니다. 모든 표에 `note`(또는 비고)에 「예시 데이터(시연용)」를 남긴다.
  · 사람 이름은 넣지 않는다 — 담당자는 ops_v0.1 의 가상 계정(부서명+직책)을 그대로 쓴다.
  · 기존 판을 덮어쓰지 않는다. `ops_v0.2_<날짜>\seed\` 에 새로 만든다(01 판의 시드는 그대로 둔다).
  · 근거가 있는 것은 근거를 쓴다(예: 계약 상대는 「○○종합건설」 같은 가상 업체명).
"""
import csv
import datetime
import hashlib
import io
import json
import pathlib
import random
import sys

csv.field_size_limit(10 ** 9)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = pathlib.Path(__file__).resolve().parent
DEMO = HERE.parent
TODAY = datetime.date.today()
STAMP = TODAY.strftime("%Y%m%d")
Y = TODAY.year
EX = "예시 데이터(시연용)"
random.seed(20260920)


def rd(p):
    return list(csv.DictReader(open(p, encoding="utf-8-sig", newline="")))


def wr(path, head, rows):
    with io.open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(head)
        w.writerows(rows)
    return len(rows)


def sha(p):
    h = hashlib.sha1()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()[:12]


def d(days):
    return (TODAY + datetime.timedelta(days=days)).isoformat()


def main(ver="v0.2"):
    src = next(p for p in sorted(DEMO.glob("ops_v0.1_*")) if p.is_dir())
    out = DEMO / ("ops_%s_%s" % (ver, STAMP))
    if any(p.name.startswith("ops_%s_" % ver) for p in DEMO.iterdir() if p.is_dir()):
        sys.exit("이 판(%s)은 이미 있다 — 새 판 번호를 쓴다" % ver)
    seed = out / "seed"
    seed.mkdir(parents=True)

    duty = rd(src / "seed" / "duty_class.csv")
    asset = rd(src / "seed" / "asset.csv")
    dept = rd(src / "seed" / "org_dept.csv")
    staff = rd(src / "seed" / "staff.csv")
    task = rd(src / "seed" / "compliance_task.csv")
    asg = {a["assign_id"]: a for a in rd(src / "seed" / "duty_assignment.csv")}
    by_code = {}
    for r in duty:
        by_code.setdefault(r["code36"], []).append(r)
    depts = [x["dept_id"] for x in dept if x["dept_id"] != "D99"]
    n = {}

    # ── 1. compliance_task 결재 칸 채우기 (이행 상태 ↔ 결재 상태는 다른 축)
    rows = []
    for i, t in enumerate(task, 1):
        a = asg.get(t["assign_id"], {})
        owner = a.get("owner_staff_id", "")
        boss = "SD02-1"                      # 안전총괄과 정담당이 결재
        st = t["status"]
        created = d(-90 + (i % 40))
        if st in ("이행완료", "점검완료", "조치필요"):
            appr = "승인" if st == "점검완료" else ("제출" if st == "이행완료" else "반려")
            sub, app, rej, why = d(-20 + (i % 10)), (d(-12 + (i % 8)) if appr == "승인" else ""), \
                (d(-10 + (i % 6)) if appr == "반려" else ""), ("증빙 사진에 일자 표기가 없음" if appr == "반려" else "")
        else:
            appr, sub, app, rej, why = "작성중", "", "", "", ""
        rows.append([t["task_id"], appr, owner, sub, owner if sub else "", app, boss if app else "",
                     rej, why, created, Y, "상반기" if (i % 2) else "하반기",
                     d(-30 + (i % 25)), (1 if st in ("이행완료", "점검완료") else 0),
                     {"점검완료": "이행완료", "조치필요": "보완필요", "기간초과": "미이행"}.get(st, "")])
    n["task_approval_patch"] = wr(seed / "task_approval_patch.csv",
                                  ["task_id", "approval_status", "created_by", "submitted_at", "submitted_by",
                                   "approved_at", "approved_by", "rejected_at", "reject_reason", "created_at",
                                   "period_year", "half_year", "plan_date", "evidence_cnt", "check_result"], rows)

    # ── 2. 도급·용역·위탁 (중처법 제5조·제9조③ — 데모에서 반드시 보여 준다)
    kinds = [("도급", "시설 유지보수"), ("용역", "청소·경비"), ("위탁", "운영 위탁")]
    firms = ["○○종합건설", "△△시설관리", "□□환경", "◇◇엔지니어링", "☆☆안전기술"]
    contracts, hazards, cduty = [], [], []
    pick_assets = [a for a in asset if a["dept_id"] != "D99"][:24]
    for i, a in enumerate(pick_assets, 1):
        k, work = kinds[i % 3]
        cid = "CTR-%04d" % i
        contracts.append([cid, "%s %s %s" % (a["asset_name"][:18], work, Y), firms[i % 5], a["asset_id"],
                          a["dept_id"], k, d(-200 + i * 3), d(160 + i * 3), 50_000_000 + i * 7_300_000,
                          "안전보건 확보 조항 있음" if i % 4 else "조항 없음 — 보완 필요",
                          "Y" if i % 3 else "N", EX])
        for j, (place, factor, lv) in enumerate([("작업 구간", "추락·전도", "높음"), ("출입 통로", "협착", "보통")], 1):
            hazards.append(["HZD-%04d-%d" % (i, j), cid, place, factor, lv, "안전난간·표지 설치", ])
        for code in ("I14", "I09", "F13", "F08"):
            for r in by_code.get(code, [])[:1]:
                cduty.append(["CDT-%04d-%s" % (i, code), cid, r["duty_key"],
                              ["이행완료", "이행대기", "보완필요"][i % 3], d(-15 + i), "", EX])
    n["contract"] = wr(seed / "contract.csv",
                       ["contract_id", "contract_name", "counterpart", "asset_id", "dept_id", "contract_type",
                        "start_date", "end_date", "amount", "safety_clause", "evaluation_done", "note"], contracts)
    n["contract_hazard"] = wr(seed / "contract_hazard.csv",
                              ["hazard_id", "contract_id", "hazard_place", "hazard_factor", "risk_level", "measure"],
                              [h[:6] for h in hazards])
    n["contract_duty"] = wr(seed / "contract_duty.csv",
                            ["cduty_id", "contract_id", "duty_key", "status", "done_at", "evidence_id", "note"], cduty)

    # ── 3. 기관장(경영책임자) 예방활동
    acts = []
    types = [("현장점검", "관내 교량 안전점검 현장 확인"), ("회의주재", "중대재해 예방 대책회의 주재"),
             ("교육", "간부 대상 중대재해처벌법 교육"), ("지시", "우기 대비 급경사지 일제점검 지시")]
    for i in range(1, 13):
        t, title = types[i % 4]
        a = pick_assets[i % len(pick_assets)]
        acts.append(["CEO-%03d" % i, d(-170 + i * 13), t, title, a["addr"] or "용인특례시",
                     "", a["asset_id"] if t == "현장점검" else "", depts[i % len(depts)],
                     "부시장·관계부서장", "안전난간 도색 상태 미흡" if t == "현장점검" else "",
                     "보수 지시(7일 내)" if t == "현장점검" else "분기별 보고 지시", "", "SD01-1", EX])
    n["ceo_activity"] = wr(seed / "ceo_activity.csv",
                           ["activity_id", "activity_date", "activity_type", "title", "place", "target_code",
                            "asset_id", "dept_id", "participants", "finding", "instruction", "follow_up_task_id",
                            "created_by", "note"], acts)

    # ── 4. 안전 예산
    bud, i = [], 0
    kinds_b = ["인력", "시설", "장비", "교육", "점검"]
    for dp in depts:
        for k in kinds_b:
            i += 1
            plan = (300 + i * 37) * 1_000_000
            bud.append(["BUD-%04d" % i, Y, dp, "", k, plan, int(plan * (0.55 + (i % 40) / 100)), "", EX])
    n["safety_budget"] = wr(seed / "safety_budget.csv",
                            ["budget_id", "fiscal_year", "dept_id", "target_code", "budget_kind",
                             "planned_amount", "executed_amount", "duty_key", "note"], bud)

    # ── 5. 교육 이수
    tr = []
    courses = [("중대재해처벌법 경영책임자 교육", "중대재해 처벌 등에 관한 법률", 20),
               ("관리감독자 정기교육", "산업안전보건법", 16),
               ("시설물 안전점검 실무", "시설물의 안전 및 유지관리에 관한 특별법", 8),
               ("어린이놀이시설 안전관리자 교육", "어린이놀이시설 안전관리법", 4),
               ("승강기 안전관리자 교육", "승강기 안전관리법", 4)]
    for i, s in enumerate(staff, 1):
        c, law, hrs = courses[i % 5]
        tr.append(["TRN-%04d" % i, s["staff_id"], s["dept_id"], c, law, hrs, d(-120 + i * 4), "", ""])
    n["training_record"] = wr(seed / "training_record.csv",
                              ["training_id", "staff_id", "dept_id", "course_name", "law", "hours",
                               "trained_at", "certificate_file", "duty_key"], tr)

    # ── 6. 종사자 의견
    voices = [("현장 순회 중 안전난간 파손 발견", "보수 요청 접수", "난간 교체 완료"),
              ("여름철 폭염 시 휴게시설 부족", "타당 — 예산 반영 검토", "그늘막 3개소 설치"),
              ("야간 작업 조도 부족", "타당", "이동식 조명 지급"),
              ("보호구 지급 주기 개선 요청", "검토 중", ""),
              ("기계식 주차장 비상벨 미작동", "긴급 — 즉시 조치", "비상벨 교체")]
    wv = [["VOC-%03d" % (i + 1), d(-100 + i * 12), ["현장 건의", "노사협의체", "익명 신고함"][i % 3],
           depts[i % len(depts)], v[0], v[1], v[2], d(-80 + i * 12) if v[2] else ""]
          for i, v in enumerate(voices)]
    n["worker_voice"] = wr(seed / "worker_voice.csv",
                           ["voice_id", "received_at", "channel", "dept_id", "content", "review_result",
                            "action_taken", "closed_at"], wv)

    # ── 7. 재해·사고(가상) · 개선명령 · 법령 개정
    inc = [["INC-001", d(-240), "중대산업재해", pick_assets[0]["asset_id"], depts[0],
            "하수처리시설 정비 중 추락(가상)", "안전난간 미설치·안전대 미착용", "부상 1명",
            "난간 전수 점검·작업 전 위험성평가 의무화", d(-200), d(-190), EX],
           ["INC-002", d(-120), "중대시민재해", pick_assets[1]["asset_id"], depts[1],
            "도로 교량 난간 파손으로 보행자 경상(가상)", "정기점검 주기 초과", "부상 1명",
            "교량 난간 일제점검·보수", d(-90), "", EX]]
    n["incident"] = wr(seed / "incident.csv",
                       ["incident_id", "occurred_at", "disaster_type", "asset_id", "dept_id", "summary",
                        "cause", "casualties", "recurrence_plan", "plan_due", "plan_done_at", "note"], inc)

    orders = [["ORD-%03d" % (i + 1), d(-150 + i * 20), ["고용노동부", "국토교통부", "경기도", "소방서"][i % 4],
               ["산업안전보건법", "시설물의 안전 및 유지관리에 관한 특별법", "화재의 예방 및 안전관리에 관한 법률"][i % 3],
               ["안전난간 보수 명령", "정밀안전진단 실시 명령", "소방시설 정비 명령", "방화문 보수 명령"][i % 4],
               d(-120 + i * 20), depts[i % len(depts)], pick_assets[i % len(pick_assets)]["asset_id"],
               d(-110 + i * 20) if i % 3 else "", "조치 완료" if i % 3 else "조치 중", ""] for i in range(6)]
    n["order_received"] = wr(seed / "order_received.csv",
                             ["order_id", "received_at", "issuer", "law", "content", "due_date", "dept_id",
                              "asset_id", "done_at", "result", "evidence_file"], orders)

    laws = [["LCH-001", "재난 및 안전관리 기본법", "재난 및 안전관리 기본법 시행령", "일부개정", d(-40), d(20), 162, "", EX],
            ["LCH-002", "시설물의 안전 및 유지관리에 관한 특별법", "시설물안전법 시행규칙", "일부개정", d(-25), d(35), 46, "", EX],
            ["LCH-003", "승강기 안전관리법", "승강기 안전관리법 시행규칙", "일부개정", d(-10), d(50), 129, "", EX]]
    n["law_change"] = wr(seed / "law_change.csv",
                         ["change_id", "law", "doc", "changed_kind", "promulgated_at", "effective_at",
                          "affected_duty_cnt", "notice_sent_at", "note"], laws)

    # ── 8. 점검 회차(취합 배치) — 참고 SCR-089·090
    batches = [["BAT-%03d" % (i + 1),
                "%d년 %s 안전보건 의무이행 점검" % (Y, ["상반기", "하반기"][i % 2]),
                Y, ["상반기", "하반기"][i % 2], "D02",
                ",".join(depts[: 4 + i]), ",".join(["F01", "F02", "F03", "F07", "F11", "I06", "I12"]),
                ["결재완료", "결재요청", "진행중"][i % 3], "SD02-1", "",
                "SD01-1" if i % 3 == 0 else "", EX] for i in range(3)]
    n["inspection_batch"] = wr(seed / "inspection_batch.csv",
                               ["batch_id", "title", "period_year", "half_year", "scope_dept_id",
                                "target_dept_ids", "code36_list", "status", "started_by", "started_at",
                                "approved_by", "note"], batches)

    # ── 매니페스트·README
    man = []
    for p in sorted(out.rglob("*")):
        if p.is_file():
            rows_n = 0
            if p.suffix == ".csv":
                with io.open(p, encoding="utf-8-sig", newline="") as f:
                    rows_n = max(sum(1 for _ in csv.reader(f)) - 1, 0)
            man.append({"파일": str(p.relative_to(out)), "행수": rows_n, "sha1": sha(p)})
    with io.open(out / "_MANIFEST.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["파일", "행수", "sha1"])
        w.writeheader()
        for r in man:
            w.writerow(r)

    (out / "_README.md").write_text(README.format(
        ver=ver, now=datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        **{k: v for k, v in n.items()}), encoding="utf-8")

    cur_p = DEMO / "_CURRENT.json"
    cur = json.loads(cur_p.read_text(encoding="utf-8")) if cur_p.exists() else {}
    cur.setdefault("ops_history", []).append(out.name)
    cur["ops"] = out.name
    cur["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    cur_p.write_text(json.dumps(cur, ensure_ascii=False, indent=1), encoding="utf-8")

    print("■ ops_%s 시드 —" % ver, out.name)
    for k, v in n.items():
        print("   %-22s %s행" % (k, "{:,}".format(v)))


README = """# ops_{ver} — 운영·관리 보강 시드 (용인시 데모 2차)

**전부 시연용 예시 데이터다.** 실제 기록이 아니며, 표마다 `note` 칸에 「예시 데이터(시연용)」가 들어 있다.
DDL 은 `_build\\ops_v0.2_add.sql` — **01_schema.sql 을 돌린 뒤** 이것을 돌리고, 그다음 아래 CSV 를 넣는다.

| 파일 | 행 | 내용 |
|---|---:|---|
| `task_approval_patch.csv` | {task_approval_patch} | 기존 `compliance_task` 에 **결재 칸**(작성중·제출·승인·반려 + 제출일·승인일·반려사유) 채우기 — `update … from` 으로 적용 |
| `contract.csv` · `contract_hazard.csv` · `contract_duty.csv` | {contract} · {contract_hazard} · {contract_duty} | 도급·용역·위탁 계약 · 위험요인 · 계약별 의무이행 |
| `ceo_activity.csv` | {ceo_activity} | 기관장(경영책임자) 예방활동 |
| `safety_budget.csv` | {safety_budget} | 부서×항목 안전 예산 편성·집행 |
| `training_record.csv` | {training_record} | 담당자 교육 이수 |
| `worker_voice.csv` | {worker_voice} | 종사자 의견 수렴·조치 |
| `incident.csv` | {incident} | 재해·사고(가상) → 재발방지대책 |
| `order_received.csv` | {order_received} | 중앙행정기관·지자체 개선·시정 명령 |
| `law_change.csv` | {law_change} | 법령 개정 알림 |
| `inspection_batch.csv` | {inspection_batch} | 점검 회차(취합 배치) · 결재 상태 |

## 결재 칸 적용 SQL (task_approval_patch)

```sql
create temp table _patch (…);          -- CSV 임포트용 임시표
update adoms2.compliance_task t set
  approval_status = p.approval_status, created_by = p.created_by,
  submitted_at = nullif(p.submitted_at,'')::timestamptz, submitted_by = p.submitted_by,
  approved_at  = nullif(p.approved_at,'')::timestamptz,  approved_by  = p.approved_by,
  rejected_at  = nullif(p.rejected_at,'')::timestamptz,  reject_reason = p.reject_reason,
  created_at   = nullif(p.created_at,'')::timestamptz,
  period_year = p.period_year, half_year = p.half_year,
  plan_date = nullif(p.plan_date,'')::date, evidence_cnt = p.evidence_cnt,
  check_result = p.check_result
from _patch p where p.task_id = t.task_id;
```

생성 {now} · `_build\\build_ops_v02_seed.py`
"""


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "v0.2")
