# -*- coding: utf-8 -*-
"""
① 체계 수립 화면(/system)용 예시 자료 — ops_v0.5 (2026-09-21)

뼈대: 중대재해처벌법 **시행령 제4조**(안전보건관리체계의 구축 및 이행 조치) 제1호~제9호.
  (법 제4조제1항제1호가 위임한 「구체적인 사항」이다 — 법 제4조와 섞지 않는다.)
  원문 대조: 정본 unit DOC-000005 a4/n1~n9 (R-20260920-10 발행판에서 읽음).

만드는 표 (모든 행 note 에 「예시 자료」)
  · safety_policy   — 경영방침·안전보건 목표 문서 (제1호)
  · safety_org_role — 선임·지정 7항목(안전보건관리규정 · 안전보건관리책임자 · 안전관리자 ·
                      보건관리자 · 산업보건의 · 산업안전보건위원회 · 관리감독자) × 부서.
                      사람 이름은 넣지 않는다 — staff_id 로만 잇는다.
  · safety_manual   — 절차·매뉴얼 문서 (제3·7·8·9호). 제5호 평가 기준은 일부러 없다.

일부러 비워 둔 곳 (모두 갖춰진 기관은 없다 — 화면에서 짚을 자리)
  · 보건관리자 미선임 2개 부서(D12 자원순환과 · D14 농업기술센터)
  · 관리감독자 미지정 1개 부서(D08 체육진흥과)
  · 산업보건의 미위촉
  · 제5호 — 안전보건관리책임자등 권한·예산 부여 문서와 업무수행 평가 기준이 없다(평가 기록도 없음)
  · 제8호 매뉴얼에 다목(추가 피해방지 조치)이 빠져 있다
  · 제9호 다목(공사기간 기준)은 문서가 없다 — 적용 여부부터 확인 필요

사용: python _build/build_system_v05.py [--force]
  판 폴더에 같은 이름의 CSV 가 있으면 멈춘다(판 덮어쓰기 금지). 아직 발행 전 판을 다시 만들 때만 --force.
"""
import csv, io, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "ops_v0.5_20260921", "seed")
EX = "예시 자료(시연용)"
FORCE = "--force" in sys.argv

DEPTS = ["D%02d" % i for i in range(1, 15)]


def wr(name, rows, cols):
    p = os.path.join(OUT, name + ".csv")
    if os.path.exists(p) and not FORCE:
        sys.exit("멈춤: %s 가 이미 있다(판 덮어쓰기 금지). 발행 전 판이면 --force" % p)
    with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            assert set(r) <= set(cols), (name, set(r) - set(cols))
            w.writerow({c: r.get(c, "") for c in cols})
    print("  %-22s %4d행" % (name + ".csv", len(rows)))
    return len(rows)


# ── safety_policy (제1호) ─────────────────────────────────────────
POL_COLS = ["policy_id", "clause_no", "policy_kind", "title", "fiscal_year", "summary",
            "enacted_at", "revised_at", "posted", "posted_where", "approver_role",
            "owner_staff_id", "note"]
policy = [
    dict(policy_id="POL-001", clause_no="1", policy_kind="경영방침", title="용인시 안전보건 경영방침",
         fiscal_year="", summary="종사자와 시민의 생명·안전을 행정의 최우선 가치로 둔다 · 유해·위험요인을 찾아 없앤다 · 종사자 의견을 듣는다",
         enacted_at="2022-03-02", revised_at="2026-01-05", posted="Y", posted_where="청사 게시판 · 내부 누리집",
         approver_role="경영책임자(시장)", owner_staff_id="SM01-1", note=EX),
    dict(policy_id="POL-002", clause_no="1", policy_kind="안전보건 목표", title="2026년 안전보건 목표",
         fiscal_year="2026", summary="중대재해 0건 · 위험성평가 전 현장 실시 · 고위험 요인 개선 100% · 관리감독자 교육 이수 100%",
         enacted_at="2026-01-12", revised_at="", posted="Y", posted_where="내부 누리집",
         approver_role="경영책임자(시장)", owner_staff_id="SM01-1", note=EX),
    dict(policy_id="POL-003", clause_no="1", policy_kind="안전보건 목표", title="2026년 부서별 세부 추진 목표",
         fiscal_year="2026", summary="부서마다 목표 수치와 추진 과제를 적는다",
         enacted_at="2026-02-03", revised_at="", posted="N", posted_where="",
         approver_role="총괄(중대재해예방과장)", owner_staff_id="SM01-1",
         note=EX + " · 부서 공유 여부 확인 필요"),
]

# ── safety_org_role (선임·지정 7항목) ────────────────────────────
ORG_COLS = ["role_id", "role_item", "scope", "dept_id", "designated", "status", "method",
            "designated_at", "law_basis", "clause_no", "staff_id", "doc_name", "last_eval_at", "note"]
BASIS = {
    "안전보건관리규정": ("산업안전보건법 제25조", ""),
    "안전보건관리책임자": ("산업안전보건법 제15조", "5"),
    "안전관리자": ("산업안전보건법 제17조", "6"),
    "보건관리자": ("산업안전보건법 제18조", "6"),
    "산업보건의": ("산업안전보건법 제22조", "6"),
    "산업안전보건위원회": ("산업안전보건법 제24조", "7"),
    "관리감독자": ("산업안전보건법 제16조", "5"),
}
org = []
n = 0


def add(item, scope, dept, yes, status, method="", at="", staff="", doc="", extra=""):
    global n
    n += 1
    law, clause = BASIS[item]
    org.append(dict(role_id="SOR-%03d" % n, role_item=item, scope=scope, dept_id=dept,
                    designated="Y" if yes else "N", status=status, method=method,
                    designated_at=at, law_basis=law, clause_no=clause, staff_id=staff,
                    doc_name=doc, last_eval_at="", note=EX + (" · " + extra if extra else "")))


# 기관 단위 4항목
add("안전보건관리규정", "기관", "", True, "제정", "직접", "2023-04-17", "SM01-1", "용인시 안전보건관리규정")
add("안전보건관리책임자", "기관", "", True, "지정", "직접", "2022-01-27", "",
    "안전보건관리책임자 지정 문서", "대상자는 인사 자료로 확인")
add("산업보건의", "기관", "", False, "미위촉", extra="위촉 또는 선임 면제 사유 확인 필요")
add("산업안전보건위원회", "기관", "", True, "구성", "직접", "2022-06-20", "SM01-1",
    "산업안전보건위원회 구성·운영 계획", "노사 동수 · 분기 1회 개최")

# 부서 단위 3항목
DATES = ["2023-02-%02d" % d for d in range(1, 29)]
for i, d in enumerate(DEPTS):
    k = int(d[1:])
    add("안전관리자", "부서", d, True, "선임", "겸직" if k > 2 else "직접", DATES[i], "%s-2" % d.replace("D", "SD"),
        "안전관리자 선임 문서")
for i, d in enumerate(DEPTS):
    if d in ("D12", "D14"):
        add("보건관리자", "부서", d, False, "미선임", extra="선임 또는 보건관리전문기관 위탁 필요")
    else:
        add("보건관리자", "부서", d, True, "선임", "위탁(보건관리전문기관)", "2023-03-%02d" % (i + 2), "",
            "보건관리 업무 위탁 계약")
for i, d in enumerate(DEPTS):
    if d == "D08":
        add("관리감독자", "부서", d, False, "미지정", extra="전임자 전보 뒤 후임 미지정")
    else:
        add("관리감독자", "부서", d, True, "지정", "직접", "2025-01-%02d" % (i + 6), "%s-1" % d.replace("D", "SD"),
            "관리감독자 지정 문서")

# ── safety_manual (제3·7·8·9호) ─────────────────────────────────
MAN_COLS = ["manual_id", "clause_no", "title", "covers", "missing", "enacted_at", "revised_at",
            "last_check_at", "owner_staff_id", "note"]
manual = [
    dict(manual_id="MAN-001", clause_no="3", title="위험성평가 실시 규정", covers="절차", missing="",
         enacted_at="2023-03-20", revised_at="2025-12-15", last_check_at="2026-06-30", owner_staff_id="SM02-1", note=EX),
    dict(manual_id="MAN-002", clause_no="7", title="종사자 의견 청취 절차", covers="절차", missing="",
         enacted_at="2023-05-10", revised_at="", last_check_at="2026-07-15", owner_staff_id="SM01-1", note=EX),
    dict(manual_id="MAN-003", clause_no="8", title="중대산업재해 대응 매뉴얼", covers="가·나", missing="다",
         enacted_at="2022-04-11", revised_at="2025-03-04", last_check_at="2026-03-27", owner_staff_id="SM02-1",
         note=EX + " · 추가 피해방지 조치(다목) 절이 없다"),
    dict(manual_id="MAN-004", clause_no="8", title="폭염·한파 시 작업중지·대피 기준", covers="가", missing="",
         enacted_at="2024-06-18", revised_at="2026-05-20", last_check_at="2026-07-08", owner_staff_id="SM02-2", note=EX),
    dict(manual_id="MAN-005", clause_no="9", title="수급인 안전보건 수준 평가 기준·절차", covers="가", missing="",
         enacted_at="2024-01-15", revised_at="2026-02-02", last_check_at="2026-07-20", owner_staff_id="SM02-3", note=EX),
    dict(manual_id="MAN-006", clause_no="9", title="도급·용역·위탁 안전보건 관리비용 기준", covers="나", missing="",
         enacted_at="2024-06-03", revised_at="", last_check_at="2026-07-20", owner_staff_id="SM02-3", note=EX),
]

print("출력:", OUT)
os.makedirs(OUT, exist_ok=True)
tot = wr("safety_policy", policy, POL_COLS) + wr("safety_org_role", org, ORG_COLS) + wr("safety_manual", manual, MAN_COLS)
assert all(EX in r["note"] for r in policy + org + manual)
assert len({r["role_id"] for r in org}) == len(org)
print("  합계 %d행 · 미지정/미선임/미위촉 %d칸" % (tot, sum(1 for r in org if r["designated"] == "N")))
