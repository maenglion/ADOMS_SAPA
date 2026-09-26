# -*- coding: utf-8 -*-
r"""용인시 데모 2차 — **운영 테이블** 만들기(ops 판). 정본·적재본은 읽기만 한다.

    python build_ops_tables.py v0.1        ops_v0.1_<날짜>\ 를 만든다(이미 있으면 멈춘다)

설계 근거  20_개발\_데모_용인시_20260920\01_설계\(설계)ADOMS_데모2차_ERD·프로세스_20260920_v0.1.html
입력
  · 3축 합본  30_데이터\_수집작업\_체크리스트_시설별\(분석)용인시_의무_3축분류_20260920_v0.2.xlsx 「전체목록_3축」
  · FMS 자산  20_개발\…\1차데모용\용인시 관리 시설\_FMS\L2판정_용인시시설물_20260906.csv (1,026)
  · 정본 발행 판 `build\_RELEASE.json` — schedule(별표·서식) 제목만 읽는다
출력 (ops 판 폴더)
  01_schema.sql   테이블 13개 DDL(PostgreSQL · Supabase)
  02_views.sql    화면이 읽는 뷰 6개
  03_load.sql     CSV 적재 순서·주의
  seed\*.csv      duty_class · org_dept · staff · asset · asset_target_map · duty_assignment
                  · compliance_task · form_template · (evidence·inspection·action·notification 은 빈 표)
  _README.md · _MANIFEST.csv

규칙
  · 판을 덮어쓰지 않는다(새 판 = 새 폴더). 정본 표의 열을 고치지 않는다.
  · 사람 이름은 넣지 않는다 — 담당자는 「부서명 + 직책」의 가상 계정이다(시연용).
  · 모든 판단층 값은 검수 전이다. 배지(badge)를 그대로 싣는다.
"""
import collections
import csv
import datetime
import hashlib
import io
import json
import os
import pathlib
import re
import sys

from openpyxl import load_workbook

csv.field_size_limit(10 ** 9)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = pathlib.Path(__file__).resolve().parent
DEMO = HERE.parent                      # _데모_용인시_20260920
DB = DEMO.parent                        # ADOMS_DB_v1
ROOT = DB.parents[2]                    # 7.ADOMS 구현
SRC = DB.parent / "_체크리스트_시설별" / "(분석)용인시_의무_3축분류_20260920_v0.2.xlsx"
FMS = ROOT / "20_개발" / "개발내용 및 산출물" / "용인시" / "1차데모용" / "용인시 관리 시설" / "_FMS" / "L2판정_용인시시설물_20260906.csv"
TODAY = datetime.date.today()
STAMP = TODAY.strftime("%Y%m%d")

# ── 부서 (교육 자료 p18 의 부서 예시 + 관리대상에 맞춘 시연용 배치) ──────────
DEPTS = [
    ("D01", "중대재해예방과", "총괄", None),
    ("D02", "안전총괄과", "관리", "D01"),
    ("D03", "도로과(교량·터널)", "현업", "D02"),
    ("D04", "상수도사업소", "현업", "D02"),
    ("D05", "하수도과", "현업", "D02"),
    ("D06", "공원녹지과", "현업", "D02"),
    ("D07", "보육정책과", "현업", "D02"),
    ("D08", "체육진흥과", "현업", "D02"),
    ("D09", "건축과(청사·건축물)", "현업", "D02"),
    ("D10", "교통정책과(경전철·주차장)", "현업", "D02"),
    ("D11", "보건소", "현업", "D02"),
    ("D12", "자원순환과", "현업", "D02"),
    ("D13", "재난안전과", "현업", "D01"),
    ("D14", "농업기술센터", "현업", "D02"),
    ("D99", "미지정", "미지정", None),
]
# 관리대상(TG) → 담당 부서
TG2DEPT = {
    "TG01": "D04", "TG02": "D05", "TG03": "D03", "TG04": "D13", "TG05": "D03", "TG06": "D13",
    "TG07": "D07", "TG08": "D06", "TG09": "D08", "TG10": "D09", "TG11": "D11", "TG12": "D06",
    "TG13": "D09", "TG14": "D10", "TG15": "D10", "TG16": "D09", "TG17": "D09", "TG18": "D09",
    "TG19": "D11", "TG20": "D09", "TG21": "D99", "TG22": "D11", "TG23": "D12", "TG24": "D13",
    "TG25": "D02", "TG26": "D02", "TG27": "D03", "TG28": "D11", "TG29": "D11", "TG30": "D11",
    "TG31": "D09", "TG99": "D99",
}
# FMS 시설 구분·종류 → 관리대상(TG)
FMS_RULES = (("TG03", r"교량|터널|육교|지하차도|도로"), ("TG05", r"옹벽|사면"), ("TG01", r"상하수도"),
             ("TG04", r"댐"), ("TG06", r"하천|수문"), ("TG13", r"건축물|공동주택"),
             ("TG25", r"건축물|공동주택|교량|터널|옹벽|사면|하천|상하수도|댐"))
# 이행 유형 → 주기(시연용 기본값 · 검수 전)
TYPE_CYCLE = {"T01": ("연1회", 365), "T02": ("수시", 180), "T03": ("연1회", 365), "T04": ("반기 1회", 180),
              "T05": ("상시", 365), "T06": ("상시", 365), "T07": ("상시", 365), "T08": ("연1회", 365),
              "T09": ("수시", 180), "T10": ("반기 1회", 180)}
STATUS_MIX = ["이행완료", "이행대기", "이행대기", "점검완료", "조치필요", "기간초과", "이행완료", "이행대기"]


def sha(p):
    h = hashlib.sha1()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()[:12]


def write_csv(path, head, rows):
    with io.open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(head)
        w.writerows(rows)
    return len(rows)


def main(ver):
    out = DEMO / ("ops_%s_%s" % (ver, STAMP))
    if any(d.name.startswith("ops_%s_" % ver) for d in DEMO.iterdir() if d.is_dir()):
        sys.exit("이 판(%s)은 이미 있다 — 새 판 번호를 쓴다" % ver)
    seed = out / "seed"
    seed.mkdir(parents=True)

    # ── 1. 의무 분류(duty_class) — 3축 합본에서
    wb = load_workbook(SRC, read_only=True)
    rs = list(wb["전체목록_3축"].iter_rows(values_only=True))
    h = rs[0]
    ix = {k: i for i, k in enumerate(h) if k}
    G = lambda r, k: ("" if (k not in ix or r[ix[k]] in (None, "None")) else str(r[ix[k]]))

    duty, seen = [], set()
    for i, r in enumerate(rs[1:], 1):
        key = "DTY-%05d" % i
        duty.append([key, G(r, "구분"), G(r, "영역"), G(r, "코드"), G(r, "표준 명칭"),
                     G(r, "세부 이행업무(문서+조)"), G(r, "관리대상 코드"), G(r, "관리대상"),
                     (G(r, "이행 유형").split() or [""])[0], G(r, "이행 유형")[4:], G(r, "법령 그룹"),
                     G(r, "그룹 이름"), G(r, "법률"), G(r, "문서"), G(r, "계층"), G(r, "조문(한글)"),
                     G(r, "조 제목"), G(r, "의무명"), G(r, "판정"), G(r, "수범주체"), G(r, "주기·임계값"),
                     G(r, "36 배정 근거"), G(r, "증빙자료(구축방안)"), G(r, "배지"), G(r, "왜(원문 근거)"),
                     G(r, "원문"), G(r, "law_id"), G(r, "doc_id"), G(r, "unit_id"), G(r, "schedule_id"),
                     G(r, "obl_id"), "pending"])
        seen.add(key)
    n_duty = write_csv(seed / "duty_class.csv",
                       ["duty_key", "yongin_mark", "area", "code36", "code36_name", "task_name",
                        "target_code", "target_name", "impl_type", "impl_type_name", "law_group",
                        "law_group_name", "law", "doc", "layer", "unit_label_ko", "article_title",
                        "duty_name", "verdict", "duty_subject", "cycle_text", "assign_basis",
                        "evidence_kind", "badge", "why", "source_text", "law_id", "doc_id", "unit_id",
                        "schedule_id", "obl_id", "review_status"], duty)

    # ── 2. 부서·담당자
    n_dept = write_csv(seed / "org_dept.csv", ["dept_id", "dept_name", "dept_role", "parent_dept_id"],
                       [[a, b, c, d or ""] for a, b, c, d in DEPTS])
    staff = []
    for a, b, c, _ in DEPTS:
        if a == "D99":
            continue
        staff.append(["S%s-1" % a, "%s 안전담당(정)" % b, a, "정담당", "%s.main@demo.yongin.go.kr" % a.lower(), ""])
        staff.append(["S%s-2" % a, "%s 안전담당(부)" % b, a, "부담당", "%s.sub@demo.yongin.go.kr" % a.lower(), ""])
    n_staff = write_csv(seed / "staff.csv", ["staff_id", "display_name", "dept_id", "duty_role", "email", "phone"], staff)

    # ── 3. 자산(FMS) · 자산 ↔ 관리대상
    fms = list(csv.DictReader(open(FMS, encoding="utf-8-sig", newline="")))
    assets, amap = [], []
    for r in fms:
        gbn, kind = r["facilGbn"], r["facilKind"]
        tgs = [c for c, rx in FMS_RULES if re.search(rx, "%s %s" % (gbn, kind))]
        dept = TG2DEPT.get(tgs[0], "D99") if tgs else "D99"
        assets.append([r["facilNo"], r["facilNm"], gbn, kind, r.get("facilClass", ""), r.get("sfGrade", ""),
                       r.get("cplYmd", ""), r.get("addr", ""), dept, "FMS", r.get("l2_result", ""),
                       r.get("basis_path", ""), r.get("need_data", ""), "N"])
        for c in tgs:
            amap.append([r["facilNo"], c, "FMS 구분·종류 규칙", "medium"])
    n_asset = write_csv(seed / "asset.csv",
                        ["asset_id", "asset_name", "asset_gbn", "asset_kind", "asset_class", "safety_grade",
                         "completed_ymd", "addr", "dept_id", "source", "sapa_l2_result", "sapa_basis",
                         "need_data", "verified"], assets)
    n_amap = write_csv(seed / "asset_target_map.csv", ["asset_id", "target_code", "basis", "confidence"], amap)

    # ── 4. 배정 — 유형 단위(기본) + 자산 단위(시연 표본)
    by_tg_asset = collections.defaultdict(list)
    for a_id, tg, _, _ in amap:
        by_tg_asset[tg].append(a_id)
    sample_assets = {tg: v[:3] for tg, v in by_tg_asset.items()}      # 관리대상마다 3건만 자산 단위로

    assigns = []
    n = 0
    for d in duty:
        (key, mark, area, code, code_name, task, tg, tg_name, tcode, tname, lf, lf_name,
         law, doc, layer, art, art_title, duty_name, verdict, subj, cyc, basis, ev, badge, why,
         text, law_id, doc_id, unit_id, sch_id, obl_id, rv) = d
        dept = TG2DEPT.get(tg, "D99")
        owner, deputy = ("S%s-1" % dept, "S%s-2" % dept) if dept != "D99" else ("", "")
        applicability = "확인필요" if (mark == "조건부" or "확인 필요" in badge) else "해당"
        cycle, days = TYPE_CYCLE.get(tcode, ("연1회", 365))
        scope = "기관" if tg in ("TG24", "TG26") else "유형"
        n += 1
        assigns.append(["ASG-%06d" % n, key, "", scope, tg, dept, owner, deputy, applicability,
                        "조건부 의무 — 보유·해당 여부 확인 필요" if applicability == "확인필요" else "",
                        cycle, days, "", "", badge])
        if scope == "유형" and applicability == "해당":
            for a_id in sample_assets.get(tg, [])[:3]:
                n += 1
                assigns.append(["ASG-%06d" % n, key, a_id, "자산", tg, dept, owner, deputy, "해당", "",
                                cycle, days, "", "", badge])
    n_asg = write_csv(seed / "duty_assignment.csv",
                      ["assign_id", "duty_key", "asset_id", "scope", "target_code", "dept_id",
                       "owner_staff_id", "deputy_staff_id", "applicability", "applicability_note",
                       "cycle", "cycle_days", "decided_by", "decided_at", "badge"], assigns)

    # ── 5. 이행 과제 — 시연용으로 「해당」 배정에만 이번 주기 1건씩
    tasks = []
    k = 0
    for a in assigns:
        if a[8] != "해당":
            continue
        k += 1
        days = int(a[11])
        due = TODAY + datetime.timedelta(days=(k * 7) % days - days // 3)
        st = STATUS_MIX[k % len(STATUS_MIX)]
        if due < TODAY and st == "이행대기":
            st = "기간초과"
        done = (due - datetime.timedelta(days=3)).isoformat() if st in ("이행완료", "점검완료", "조치필요") else ""
        tasks.append(["TSK-%06d" % k, a[0], "%d년 %s" % (TODAY.year, a[10]), due.isoformat(), st,
                      done, a[6] if done else "", ""])
    n_task = write_csv(seed / "compliance_task.csv",
                       ["task_id", "assign_id", "period_label", "due_date", "status", "done_at",
                        "done_by", "remark"], tasks)

    # ── 6. 서식(별표·별지) — 정본 schedule 제목만 가져온다
    rel = json.loads((DB / "build" / "_RELEASE.json").read_text(encoding="utf-8"))
    want = {d[29] for d in duty if d[29]}
    forms = []
    if want:
        for s in csv.DictReader(open(DB / "build" / rel["tables"]["schedule"]["file"],
                                     encoding="utf-8-sig", newline="")):
            if s["schedule_id"] in want:
                forms.append([s["schedule_id"], s["title_ko"], s["doc_id"], s["law_id"],
                              s.get("schedule_kind", ""), s.get("schedule_no", ""), "정본 별표·서식",
                              "", "", rel["release"]])
    n_form = write_csv(seed / "form_template.csv",
                       ["form_id", "title", "doc_id", "law_id", "schedule_kind", "schedule_no",
                        "source", "file_html", "file_docx", "canon_release"], forms)

    for nm, cols in (("evidence", ["evidence_id", "task_id", "evidence_kind", "file_name", "file_url",
                                   "form_id", "uploaded_by", "uploaded_at", "note"]),
                     ("inspection", ["insp_id", "task_id", "inspector_staff_id", "insp_date", "result",
                                     "finding", "note"]),
                     ("action", ["action_id", "insp_id", "action_type", "due_date", "done_at", "result", "note"]),
                     ("notification", ["noti_id", "staff_id", "task_id", "kind", "sent_at", "read_at", "body"])):
        write_csv(seed / ("%s.csv" % nm), cols, [])

    # ── 7. SQL
    (out / "01_schema.sql").write_text(SCHEMA_SQL, encoding="utf-8")
    (out / "02_views.sql").write_text(VIEWS_SQL, encoding="utf-8")
    (out / "03_load.sql").write_text(LOAD_SQL, encoding="utf-8")

    man = []
    for p in sorted(out.rglob("*")):
        if p.is_file():
            rows = 0
            if p.suffix == ".csv":
                with io.open(p, encoding="utf-8-sig", newline="") as f:
                    rows = max(sum(1 for _ in csv.reader(f)) - 1, 0)
            man.append({"파일": str(p.relative_to(out)), "행수": rows, "sha1": sha(p)})
    with io.open(out / "_MANIFEST.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["파일", "행수", "sha1"])
        w.writeheader()
        for r in man:
            w.writerow(r)

    (out / "_README.md").write_text(README.format(
        ver=ver, stamp=STAMP, rel=rel["release"], duty=n_duty, dept=n_dept, staff=n_staff,
        asset=n_asset, amap=n_amap, asg=n_asg, task=n_task, form=n_form,
        now=datetime.datetime.now().strftime("%Y-%m-%d %H:%M")), encoding="utf-8")

    cur_p = DEMO / "_CURRENT.json"
    cur = json.loads(cur_p.read_text(encoding="utf-8")) if cur_p.exists() else {}
    cur.setdefault("ops_history", []).append(out.name)
    cur["ops"] = out.name
    cur["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    cur_p.write_text(json.dumps(cur, ensure_ascii=False, indent=1), encoding="utf-8")

    print("■ 운영 테이블 판 —", out.name)
    for nm, v in (("duty_class", n_duty), ("org_dept", n_dept), ("staff", n_staff), ("asset", n_asset),
                  ("asset_target_map", n_amap), ("duty_assignment", n_asg), ("compliance_task", n_task),
                  ("form_template", n_form)):
        print("   %-18s %s행" % (nm, "{:,}".format(v)))
    print("   빈 표 4개(evidence·inspection·action·notification) · SQL 3개")


SCHEMA_SQL = r"""-- 용인시 데모 2차 · 운영 테이블 (PostgreSQL / Supabase)
-- 설계: 20_개발\_데모_용인시_20260920\01_설계\(설계)ADOMS_데모2차_ERD·프로세스_20260920_v0.1.html
-- 규칙: 화면은 이 표를 직접 읽지 않는다 — 02_views.sql 의 뷰만 읽는다.

create schema if not exists adoms2;
set search_path = adoms2, public;

-- ② 분류층(읽기 전용 · 정본+분류 스냅숏) -------------------------------------
create table if not exists duty_class (
  duty_key        text primary key,
  yongin_mark     text,                     -- Y · 조건부
  area            text,                     -- I · F · M
  code36          text,  code36_name text,  -- 중처법 의무조항 36
  task_name       text,                     -- 2단 세부 이행업무(문서+조)
  target_code     text,  target_name  text, -- 관리대상 TG
  impl_type       text,  impl_type_name text,-- 이행 유형 T
  law_group       text,  law_group_name text,
  law text, doc text, layer text, unit_label_ko text, article_title text, duty_name text,
  verdict text, duty_subject text, cycle_text text, assign_basis text, evidence_kind text,
  badge text, why text, source_text text,
  law_id text, doc_id text, unit_id text, schedule_id text, obl_id text,
  review_status   text default 'pending'
);
create index if not exists ix_duty_code on duty_class(code36);
create index if not exists ix_duty_target on duty_class(target_code);
create index if not exists ix_duty_law on duty_class(law);

-- ③ 기관층 -------------------------------------------------------------------
create table if not exists org_dept (
  dept_id text primary key, dept_name text not null, dept_role text, parent_dept_id text
);
create table if not exists staff (
  staff_id text primary key, display_name text not null, dept_id text references org_dept(dept_id),
  duty_role text, email text, phone text
);
create table if not exists asset (
  asset_id text primary key, asset_name text, asset_gbn text, asset_kind text, asset_class text,
  safety_grade text, completed_ymd text, addr text,
  dept_id text references org_dept(dept_id), source text,
  sapa_l2_result text, sapa_basis text, need_data text, verified text default 'N'
);
create table if not exists asset_target_map (
  asset_id text references asset(asset_id), target_code text, basis text, confidence text,
  primary key (asset_id, target_code)
);

-- ④ 배정층 -------------------------------------------------------------------
create table if not exists duty_assignment (
  assign_id text primary key,
  duty_key text references duty_class(duty_key),
  asset_id text references asset(asset_id),           -- null 이면 유형·기관 단위
  scope text check (scope in ('기관','유형','자산')),
  target_code text,
  dept_id text references org_dept(dept_id),
  owner_staff_id text references staff(staff_id),      -- 담당자 정
  deputy_staff_id text references staff(staff_id),     -- 담당자 부
  applicability text check (applicability in ('해당','비해당','확인필요')) default '확인필요',
  applicability_note text, cycle text, cycle_days int,
  decided_by text, decided_at timestamptz, badge text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists ix_asg_dept on duty_assignment(dept_id);
create index if not exists ix_asg_duty on duty_assignment(duty_key);

-- ⑤ 이행층 -------------------------------------------------------------------
create table if not exists compliance_task (
  task_id text primary key,
  assign_id text references duty_assignment(assign_id),
  period_label text, due_date date,
  status text check (status in ('이행대기','기간초과','이행완료','조치필요','점검완료')) default '이행대기',
  done_at date, done_by text references staff(staff_id), remark text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists ix_task_status on compliance_task(status);
create index if not exists ix_task_due on compliance_task(due_date);

create table if not exists form_template (
  form_id text primary key, title text, doc_id text, law_id text, schedule_kind text,
  schedule_no text, source text, file_html text, file_docx text, canon_release text
);
create table if not exists evidence (
  evidence_id text primary key, task_id text references compliance_task(task_id),
  evidence_kind text, file_name text, file_url text, form_id text references form_template(form_id),
  uploaded_by text references staff(staff_id), uploaded_at timestamptz default now(), note text
);
create table if not exists inspection (
  insp_id text primary key, task_id text references compliance_task(task_id),
  inspector_staff_id text references staff(staff_id), insp_date date,
  result text check (result in ('적합','부적합','보류')), finding text, note text
);
create table if not exists action (
  action_id text primary key, insp_id text references inspection(insp_id),
  action_type text, due_date date, done_at date, result text, note text
);
create table if not exists notification (
  noti_id text primary key, staff_id text references staff(staff_id),
  task_id text references compliance_task(task_id), kind text,
  sent_at timestamptz default now(), read_at timestamptz, body text
);
"""

VIEWS_SQL = r"""-- 화면이 읽는 뷰 (테이블 직접 접근 금지)
set search_path = adoms2, public;

-- 담당자 To-Do
create or replace view v_duty_todo as
select t.task_id, t.status, t.due_date, (t.due_date - current_date) as days_left,
       a.assign_id, a.dept_id, d0.dept_name, a.owner_staff_id, a.deputy_staff_id,
       a.applicability, a.scope, a.asset_id, s.asset_name,
       c.duty_key, c.area, c.code36, c.code36_name, c.impl_type, c.impl_type_name,
       c.target_code, c.target_name, c.law, c.doc, c.unit_label_ko, c.duty_name,
       c.evidence_kind, c.badge, c.yongin_mark
from compliance_task t
join duty_assignment a on a.assign_id = t.assign_id
join duty_class c on c.duty_key = a.duty_key
left join asset s on s.asset_id = a.asset_id
left join org_dept d0 on d0.dept_id = a.dept_id;

-- 의무 상세(조문·증빙·서식)
create or replace view v_duty_detail as
select c.*, f.form_id, f.title as form_title, f.source as form_source
from duty_class c
left join form_template f on f.form_id = c.schedule_id;

-- 관리대상(자산) 화면
create or replace view v_asset_duty as
select s.asset_id, s.asset_name, s.asset_gbn, s.asset_kind, s.asset_class, s.safety_grade,
       s.dept_id, s.sapa_l2_result, m.target_code, c.duty_key, c.code36, c.code36_name,
       c.impl_type_name, c.law, c.unit_label_ko, c.duty_name, c.badge, c.yongin_mark
from asset s
join asset_target_map m on m.asset_id = s.asset_id
join duty_class c on c.target_code = m.target_code;

-- 부서별 진도
create or replace view v_dept_progress as
select d0.dept_id, d0.dept_name, t.status, count(*) as cnt
from compliance_task t
join duty_assignment a on a.assign_id = t.assign_id
join org_dept d0 on d0.dept_id = a.dept_id
group by 1,2,3;

-- 법령 화면 (그룹 → 법률 → 문서 → 조)
create or replace view v_law_tree as
select law_group, law_group_name, law, doc, layer, unit_label_ko, article_title,
       count(*) as duty_cnt, min(code36) as sample_code
from duty_class group by 1,2,3,4,5,6,7;

-- 대시보드 요약
create or replace view v_kpi_summary as
select c.area, c.code36, c.code36_name,
       count(*) filter (where t.status = '이행완료') as done,
       count(*) filter (where t.status = '점검완료') as checked,
       count(*) filter (where t.status = '조치필요') as need_action,
       count(*) filter (where t.status = '기간초과') as overdue,
       count(*) filter (where t.status = '이행대기') as waiting,
       count(*) as total
from compliance_task t
join duty_assignment a on a.assign_id = t.assign_id
join duty_class c on c.duty_key = a.duty_key
group by 1,2,3;
"""

LOAD_SQL = r"""-- 적재 순서 (Supabase: Table Editor → Import CSV, 또는 psql \copy)
-- 1) 01_schema.sql 실행
-- 2) 아래 순서로 seed\*.csv 적재 (외래키 때문에 순서가 중요하다)
--    org_dept → staff → asset → asset_target_map → duty_class
--    → duty_assignment → compliance_task → form_template
--    (evidence · inspection · action · notification 은 빈 표 — 화면에서 쌓인다)
-- 3) 02_views.sql 실행
-- 4) 화면은 뷰만 읽는다. 쓰기는 공통 경로(업로드·상태 변경)로만 한다.

-- psql 예시
-- \copy adoms2.org_dept from 'seed/org_dept.csv' csv header encoding 'UTF8';
-- \copy adoms2.staff    from 'seed/staff.csv'    csv header encoding 'UTF8';
-- …
"""

README = """# ops_{ver} — 용인시 데모 2차 운영 테이블 ({stamp})

**정본이 아니다.** 시연용 운영 데이터다. 판을 덮어쓰지 않는다(바뀌면 `ops_v0.2_…` 새 폴더).
설계 근거: `20_개발\\_데모_용인시_20260920\\01_설계\\(설계)ADOMS_데모2차_ERD·프로세스_20260920_v0.1.html`

## 무엇이 들어 있나

| 파일 | 행 | 내용 |
|---|---:|---|
| `seed\\duty_class.csv` | {duty} | 3축 분류 의무(읽기 전용 스냅숏 · 배지·증빙·정본 조인 키 포함) |
| `seed\\org_dept.csv` | {dept} | 부서(총괄·관리·현업) — 교육 자료 p18 예시를 따른 **시연용 가상 조직** |
| `seed\\staff.csv` | {staff} | 담당자 정·부 — **실명 없음**(부서명 + 직책) |
| `seed\\asset.csv` | {asset} | FMS 시설물(용인시) · 중처법 L2 판정 표시 |
| `seed\\asset_target_map.csv` | {amap} | 자산 ↔ 관리대상(TG) |
| `seed\\duty_assignment.csv` | {asg} | 의무 × (기관·유형·자산) × 부서 · 담당자 정/부 · 적용 여부 |
| `seed\\compliance_task.csv` | {task} | 이번 주기 이행 과제(상태 5종) |
| `seed\\form_template.csv` | {form} | 별표·별지서식 — 정본 `schedule` 제목(판 {rel}) |
| `seed\\evidence · inspection · action · notification` | 0 | 화면에서 쌓이는 표(빈 껍데기) |
| `01_schema.sql` · `02_views.sql` · `03_load.sql` | — | DDL · 뷰 6개 · 적재 순서 |

## 꼭 알아야 할 것

1. **부서·담당자는 가상이다.** 실제 용인시 조직·담당자와 맞추려면 사용자 확인이 필요하다. 실명은 넣지 않았다.
2. **적용 여부(`applicability`)** — 조건부 의무와 「확인 필요」 배지가 붙은 배정은 `확인필요`로 들어간다. 화면에서 담당 부서가 해당/비해당을 정한다.
3. **자산 단위 배정은 표본이다.** 관리대상마다 최대 3건만 자산에 붙였다(전수로 붙이면 수만 행이 된다). 나머지는 유형 단위.
4. **이행 과제 상태는 시연용으로 섞어 넣었다.** 실제 이행 기록이 아니다.
5. **주기는 이행 유형 기본값**이다(T04 반기 1회 등). 조문에 적힌 주기와 다를 수 있다 — 검수 대상.
6. 화면은 **뷰만 읽는다**. 표를 직접 읽지 않는다.

생성 {now} · `_build\\build_ops_tables.py`
"""


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "v0.1")
