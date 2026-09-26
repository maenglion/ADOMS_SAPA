# -*- coding: utf-8 -*-
"""
us_v1.9_20260926 — 「이행점검 및 조치」 메뉴 예시 자료(교육자료 버전 3400 전용).

만드는 것(표는 통째로 이 판이 이긴다 → 기존 판의 행을 **모두** 그대로 싣고 새 행을 뒤에 더한다):
  usf_round · usf_judge · notification      — 이행점검(사업장·공중이용시설·공중교통수단·원료·제조물)
  hazard_report · hazard_step               — 유해·위험요인 개선
  incident · order_received · incident_nil_check · incident_report · incident_response — 개선·시정명령 등 조치
  inspection · action                        — 미이행 조치·재점검(과제 결재 기록 쪽 보완 제출·완료 흐름)

원칙
  · 기존 행의 id·값은 바꾸지 않는다(생성 뒤 전수 대조로 확인). 새 칸은 맨 뒤에 붙이고 기존 행은 빈칸.
  · 새 id 는 기존 대역 뒤(덮개 .data/overlay.json 의 화면 입력 id 와 겹치지 않음).
  · 사람은 직원 명부(staff)의 가상 인물만. 경영책임자는 CEO-1(「시장」).
  · 법 조문은 lawtext 판 원문으로 확인한 것만 적는다(lawlook.py) — 확인한 조문 목록은 README.
  · 씨앗 고정(random.Random(20260926)) — 다시 돌려도 같은 결과.
  · 날짜는 2026-01 ~ 2026-09-26(오늘). 예외 둘(시설물안전법 보수·보강 기준일 2025년 — README 설명).
사용: python build_check_v19.py            → ../seed_wip 에 쓴다(검증 통과 시)
      python build_check_v19.py --publish  → 검증 통과 뒤 ../seed 로 옮긴다
"""
import csv, io, json, os, random, shutil, sys
from collections import defaultdict, Counter

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
VER = os.path.dirname(HERE)                      # us_v1.9_20260926
ROOT = os.path.dirname(VER)                      # _데모_용인시_20260920
APP = os.path.join(ROOT, "..", "..", "..", "..", "20_개발", "_데모_용인시_20260920", "04_앱", "adoms2_v4")
OUT = os.path.join(VER, "seed_wip")
RNG = random.Random(20260926)

# 원천 판(표마다 지금 앱이 읽는 판 — opsDirs: us_* 새것 → ops_* 새것)
SRC = {
    "usf_round": "us_v1.0_20260924", "usf_judge": "us_v1.0_20260924",
    "notification": "ops_v2.2_20260924",
    "hazard_report": "ops_v1.9_20260924", "hazard_step": "ops_v0.6_20260921",
    "incident": "ops_v1.9_20260924", "order_received": "ops_v1.9_20260924",
    "incident_nil_check": "ops_v0.6_20260921",
    "incident_report": "ops_v0.8_20260922", "incident_response": "ops_v0.8_20260922",
    "inspection": "ops_v2.2_20260924", "action": "ops_v0.3_20260921",
}
KEY = {
    "usf_round": "round_id", "usf_judge": "judge_id", "notification": "notif_id", "hazard_report": "hz_id",
    "hazard_step": "step_id", "incident": "incident_id", "order_received": "order_id", "incident_nil_check": "nil_id",
    "incident_report": "report_id", "incident_response": "resp_id", "inspection": "insp_id", "action": "action_id",
}
NOTE = "예시 자료"


def read(ver, table):
    p = os.path.join(ROOT, ver, "seed", table + ".csv")
    with open(p, encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        return r.fieldnames, list(r)


def latest(table):
    """앱과 같은 순서로 그 표를 가진 가장 새 판을 찾는다(검증용)."""
    dirs = sorted(os.listdir(ROOT))
    us = sorted([d for d in dirs if d.startswith("us_") and d != os.path.basename(VER)], reverse=True)
    ops = sorted([d for d in dirs if d.startswith("ops_")], reverse=True)
    for d in us + ops:
        if os.path.exists(os.path.join(ROOT, d, "seed", table + ".csv")):
            return d
    return None


# ── 기준 자료 ────────────────────────────────────────────────
_, STAFF = read("ops_v1.9_20260924", "staff")
_, DEPTS = read("ops_v1.9_20260924", "org_dept")
_, ASSETS = read("us_v1.7_20260925", "asset")
DN = {d["dept_id"]: d["dept_name"] for d in DEPTS}
SN = {s["staff_id"]: s["display_name"] for s in STAFF}
AS = {a["asset_id"]: a for a in ASSETS}
OWNER = {d: f"SD{d[1:]}-1" for d in DN}      # 정담당
DEPUTY = {d: f"SD{d[1:]}-2" for d in DN}     # 부담당
for d in list(OWNER):
    assert OWNER[d] in SN or d == "D99", d
OVERLAY = json.load(open(os.path.join(APP, ".data", "overlay.json"), encoding="utf-8"))


def ov_ids(table, key):
    return {r.get(key) for r in (OVERLAY.get("tables") or {}).get(table, [])}


# ── 이행점검 항목(app/check/_lib.ts itemsOf · lib/us/steps_*.ts 와 같은 이름·순서) ──
ITEMS = {
    "ws": [("goal", "안전·보건 목표 및 경영방침 설정"), ("org", "안전·보건·총괄·관리 전담 조직 설치"), ("staff", "안전보건관계자 배치"),
           ("risk", "유해·위험요인 확인 및 개선 절차 마련(위험성평가)"), ("budget", "안전예산 편성·집행"), ("work", "안전보건관계자 업무수행"),
           ("opinion", "종사자 의견 청취 및 개선"), ("emergency", "비상조치계획 수립 및 이행"), ("recur", "재해발생시 재발방지 대책 수립 및 이행"),
           ("order", "개선·시정 등을 명한 사항 이행"), ("law", "관계 법령상 의무이행"), ("edu", "법정교육 이수")],
    "fc": [("staff", "안전인력 확보"), ("budget", "안전예산 편성·집행"), ("inspect", "안전점검 계획 수립·수행"), ("plan", "안전계획 수립·이행"),
           ("proc", "재해예방업무처리절차"), ("recur", "재해발생시 재발방지 대책 수립 및 이행"), ("order", "개선·시정 등을 명한 사항 이행"),
           ("law", "관계 법령상 의무이행")],
    "mt": [("staff", "안전인력 확보"), ("budget", "중대시민재해 예방 예산 편성·집행"), ("proc", "재해예방업무처리 절차 마련·이행"),
           ("recur", "재해발생시 재발방지 대책 수립 및 이행"), ("order", "중앙행정기관, 지자체 개선·시정 사항 이행"), ("law", "관계 법령 의무이행 조치")],
}
NAME = {"ws": "사업장", "fc": "공중이용시설·공중교통수단", "mt": "원료·제조물"}
PFX = {"ws": "RWS", "fc": "RFC", "mt": "RMT"}
SYM = {"이행완료": "O", "보완필요": "△", "미이행": "X", "해당없음": "-"}
INO = {t: {k: i + 1 for i, (k, _) in enumerate(v)} for t, v in ITEMS.items()}
ILB = {t: dict(v) for t, v in ITEMS.items()}

# 회차에 넣는 부서(각 대상의 취합 대상 목록 deptsOf 안에서 — 사업장은 본청 부서만, 사업소는 시민재해 대상에만)
DEPT_H1 = {"ws": ["D01", "D02", "D03", "D07", "D08", "D09", "D12", "D13", "D15"],
           "fc": ["D02", "D03", "D04", "D05", "D09", "D13", "D16", "D23"],
           "mt": ["D04", "D07", "D11", "D14"]}
DEPT_H2 = {"ws": DEPT_H1["ws"] + ["D10", "D16", "D19"], "fc": DEPT_H1["fc"], "mt": DEPT_H1["mt"]}

# 부서별로 무엇을 관리하는지(점검내용에 쓰는 말)
FAC = {"D02": "공공청사·제3종시설물", "D03": "교량·터널·옹벽", "D04": "정수장·배수지", "D05": "공공하수처리시설(레스피아)",
       "D09": "공공건축물·체육시설", "D13": "재난대응 시설·방재시설", "D16": "용인경전철(역사·차량)", "D23": "농업용 저수지"}
MAT = {"D04": "수돗물(정수)", "D07": "시립어린이집 급식", "D11": "보건소 취급 식품·의약외품", "D14": "학교급식 식재료(친환경 농산물)"}

# ── 점검내용(판정 칸의 글) — 대상·항목·판정별 ─────────────────────
def T(d, key, st, track, half):
    fac, mat = FAC.get(d, "소관 시설"), MAT.get(d, "소관 원료·제조물")
    H = "상반기" if half == "H1" else "하반기"
    W = {
        ("ws", "goal"): {"이행완료": f"2026년 안전·보건 경영방침 부서 게시·공람 확인(게시 사진·공람 기록 첨부)",
                         "보완필요": "경영방침 공람 기록은 있으나 부서 게시 사진이 없음 — 게시 증빙 보완",
                         "미이행": "경영방침 부서 공유 기록 없음 — 공람·부서 교육 뒤 증빙 제출"},
        ("ws", "org"): {"이행완료": "중대재해예방팀 전담 인력 배치·직제 반영 확인(조직도·사무분장)",
                        "해당없음": "전담 조직 설치는 총괄 부서(중대재해예방팀) 몫 — 부서 해당 없음"},
        ("ws", "staff"): {"이행완료": "관리감독자 지정 공문·명단 확인",
                          "보완필요": "인사이동 뒤 관리감독자 재지정 공문 없음 — 지정 공문 보완",
                          "미이행": "관리감독자 미지정 — 지정 뒤 명단 제출"},
        ("ws", "risk"): {"이행완료": f"{H} 정기 위험성평가 실시·감소대책 공유 확인",
                         "보완필요": "위험성평가는 했으나 감소대책 이행 확인 사진 누락",
                         "미이행": f"{H} 정기 위험성평가 미실시"},
        ("ws", "budget"): {"이행완료": "안전·보건 예산 편성·집행 내역 확인(보호구·작업환경 개선)",
                           "보완필요": "편성 내역은 있으나 집행 증빙(지출결의서) 일부 누락",
                           "미이행": "안전·보건 예산 편성 내역 없음"},
        ("ws", "work"): {"이행완료": "관리감독자 업무수행 평가표 제출 확인",
                         "보완필요": "업무수행 평가표에 평가 기준 항목 누락 — 기준대로 다시 작성",
                         "미이행": "관리감독자 업무수행 평가 미실시"},
        ("ws", "opinion"): {"이행완료": "부서 간담회로 종사자 의견 청취·개선 결과 회신 확인",
                            "보완필요": "의견은 청취했으나 개선 결과 회신 기록 없음",
                            "미이행": "종사자 의견 청취 기록 없음"},
        ("ws", "emergency"): {"이행완료": "비상대응 매뉴얼 비치·부서 대피훈련 실시 확인",
                              "보완필요": "대피훈련은 했으나 결과보고서 누락",
                              "미이행": "비상대응 매뉴얼 부서 비치 없음"},
        ("ws", "law"): {"이행완료": "관계 법령(산업안전보건법 등) 의무 이행 점검표 제출 확인",
                        "보완필요": "관계 법령 점검표 일부 항목 증빙 누락(작업환경측정 결과)",
                        "미이행": "관계 법령 의무 이행 점검표 미제출"},
        ("ws", "edu"): {"이행완료": "정기 안전보건교육 이수 명단 확인",
                        "보완필요": "신규 채용자 채용 시 교육 이수 증빙 없음",
                        "미이행": "정기 안전보건교육 이수 기록 없음"},
        ("fc", "staff"): {"이행완료": f"{fac} 안전관리 인력 배치 현황 확인",
                          "보완필요": f"{fac} 안전관리 담당 교체 뒤 교육 이수 증빙 누락",
                          "미이행": f"{fac} 안전관리 인력 미배치"},
        ("fc", "budget"): {"이행완료": f"{fac} 점검·보수 예산 편성·집행 확인",
                           "보완필요": f"{fac} 보수 예산 집행 실적 미제출",
                           "미이행": f"{fac} 안전 예산 편성 내역 없음"},
        ("fc", "inspect"): {"이행완료": f"{H} {fac} 정기안전점검 결과보고서 확인",
                            "보완필요": f"{fac} 정기안전점검 결과 시설물통합정보관리시스템(FMS) 입력 지연",
                            "미이행": f"{H} {fac} 안전점검 계획 미수립"},
        ("fc", "plan"): {"이행완료": f"2026년 {fac} 안전계획 수립·이행 실적 확인",
                         "보완필요": "안전계획 대비 이행 실적 누락 — 실적표 보완",
                         "미이행": "올해 안전계획 미수립"},
        ("fc", "proc"): {"이행완료": "유해·위험요인 신고·조치 절차대로 처리 확인(신고 대장)",
                         "보완필요": "신고 처리 결과 신고자 통보 기록 누락",
                         "미이행": "유해·위험요인 신고·조치 절차 미운영"},
        ("fc", "law"): {"이행완료": "관계 법령(시설물안전법·재난안전법 등) 의무 이행 점검표 확인",
                        "보완필요": "관계 법령 점검표 중 교육 이수 항목 증빙 누락",
                        "미이행": "관계 법령 의무 이행 점검표 미제출"},
        ("mt", "staff"): {"이행완료": f"{mat} 안전관리 인력 배치 확인",
                          "보완필요": f"{mat} 담당 교체 뒤 업무 인수인계 기록 없음",
                          "미이행": f"{mat} 안전관리 인력 미지정"},
        ("mt", "budget"): {"이행완료": f"{mat} 안전 예산(검사·설비) 편성·집행 확인",
                           "보완필요": f"{mat} 검사 예산 집행 증빙 누락",
                           "미이행": f"{mat} 안전 예산 편성 내역 없음"},
        ("mt", "proc"): {"이행완료": f"{mat} 유해·위험요인 점검·이상 시 공급 중단 절차 운영 확인",
                         "보완필요": f"{mat} 이상 발생 시 주민 알림 절차 문서 미비",
                         "미이행": f"{mat} 재해예방 업무처리 절차 미마련"},
        ("mt", "law"): {"이행완료": "관계 법령(수도법·먹는물관리법·식품위생법 등) 의무 이행 점검표 확인",
                        "보완필요": "관계 법령 점검표 중 검사 성적서 일부 누락",
                        "미이행": "관계 법령 의무 이행 점검표 미제출"},
    }
    m = W.get((track, key), {})
    if st in m:
        return m[st]
    if st == "해당없음":
        return {"recur": f"{H} {NAME[track]} 관련 재해 발생 없음", "order": f"{H}에 받은 {NAME[track]} 관련 개선·시정명령 없음"}.get(key, "해당 의무 없음")
    return {"이행완료": "이행 확인", "보완필요": "증빙 보완 필요", "미이행": "이행 기록 없음"}[st]


# 재해·명령과 맞춘 판정(recur·order) — 개선·시정명령 등 조치 화면의 사고·명령 번호와 같다
FIXED = {
    # (반기, 대상, 항목, 부서) : (판정, 점검내용, 판정일) — 사고·명령 번호는 「개선·시정명령 등 조치」 화면과 같다
    ("H1", "ws", "recur", "D01"): ("이행완료", "사고-001 재발방지 대책 이행(기한 10일 넘겨 03-14 완료) · 효과 확인 「유효」(06-10)", "2026-06-12"),
    ("H1", "ws", "order", "D01"): ("보완필요", "명령-001 안전난간 보수 명령 기한(05-23) 지남 — 조치 중, 이행 결과 보고 필요", "2026-06-02"),
    ("H1", "ws", "recur", "D15"): ("보완필요", "사고-011(중대산업재해) 원인 조사·대책 수립 끝 — 대책 이행 기한 07-31, 이행 결과 제출 필요", "2026-06-05"),
    ("H1", "ws", "order", "D15"): ("이행완료", "명령-020 작업중지 명령 — 조치 완료·해제 요청(05-02) · 해제 통보(05-10)", "2026-05-20"),
    ("H1", "fc", "recur", "D02"): ("보완필요", "사고-002 대책 수립(06-05)은 끝냈으나 이행 전 — 이행 기한 06-22까지 결과 제출", "2026-06-10"),
    ("H1", "fc", "order", "D02"): ("보완필요", "명령-002 정밀안전진단 실시 명령 기한(06-12) 지남 — 진단 진행 중", "2026-06-15"),
    ("H1", "fc", "order", "D03"): ("보완필요", "명령-003 소방시설 정비 명령 조치 중(기한 07-02)", "2026-06-11"),
    ("H1", "fc", "order", "D09"): ("보완필요", "명령-022 옥내소화전 개수 명령 조치 중(기한 07-10) — 가압펌프 정비 결과 제출", "2026-06-16"),
    ("H1", "mt", "order", "D04"): ("이행완료", "명령-023 정수처리기준 개선 명령 기한 안 이행 · 결과 보고(04-03) · 발령기관 확인(04-20)", "2026-05-20"),
    ("H2", "ws", "recur", "D15"): ("이행완료", "사고-011 대책 이행 완료(07-24) — 효과 확인은 09-30까지", "2026-08-26"),
    ("H2", "ws", "recur", "D12"): ("보완필요", "사고-009 원인 조사 끝(09-10) — 대책 수립 기한(09-17) 지남, 대책 문서 제출", "2026-09-21"),
    ("H2", "ws", "order", "D01"): ("미이행", "명령-001 안전난간 보수 명령 기한(05-23) 넉 달 지남 — 이행 완료 보고 없음", "2026-08-27"),
    ("H2", "ws", "order", "D12"): ("보완필요", "명령-008 비상정지장치 설치 기한(09-25) 임박 · 명령-025 파쇄기 방호덮개 명령 접수(09-22) — 담당 지정 필요", "2026-09-24"),
    ("H2", "fc", "recur", "D02"): ("미이행", "사고-002 재발방지 대책 이행 기한(06-22) 두 달 지남 — 이행 기록 없음", "2026-08-24"),
    ("H2", "fc", "recur", "D03"): ("보완필요", "사고-005 대책 수립(08-07) 끝 — 이행 기한 10-31, 조명 전수 점검 진행 실적 제출", "2026-08-25"),
    ("H2", "fc", "recur", "D09"): ("보완필요", "사고-013 대책 수립 기한(09-18) 지남 — 대책 문서 제출", "2026-09-21"),
    ("H2", "fc", "order", "D03"): ("보완필요", "명령-026 교대부 세굴 보강(기한 10-01)·명령-011 터널 배수로 보수(기한 10-15) 조치 중 · 명령-021 옹벽 보수·보강 착수(09-21)", "2026-09-22"),
    ("H2", "fc", "order", "D05"): ("이행완료", "명령-005 안전난간 보수 이행(08-21, 기한 08-11 넘김) · 발령기관 확인(09-05)", "2026-09-07"),
    ("H2", "fc", "order", "D09"): ("보완필요", "명령-009 기간 연장(10-10) 유도등 교체 중 · 명령-016 방화셔터 개수 명령 접수(09-18)", "2026-09-21"),
    ("H2", "mt", "recur", "D14"): ("해당없음", "하반기 원료·제조물 재해 없음 — 아차사고(사고-014)는 예방 기록으로 관리", "2026-09-20"),
}
# 이 칸은 판정하지 않는다(판정 전 · 자료 기준 제안이 보이게)
SKIP_H2 = {("ws", "law"), ("ws", "edu"), ("fc", "law"), ("mt", "law")}


def pick(weights):
    x = RNG.random()
    acc = 0.0
    for k, w in weights:
        acc += w
        if x < acc:
            return k
    return weights[-1][0]


def ts(day, hh, mm):
    return f"{day}T{hh:02d}:{mm:02d}:00+09:00"


def add_days(day, n):
    import datetime as dt
    d = dt.date.fromisoformat(day) + dt.timedelta(days=n)
    return d.isoformat()


# ─────────────────────────────────────────────────────────
def build():
    new = defaultdict(list)          # table -> new rows
    extra_cols = defaultdict(list)   # table -> new columns
    nid = {"JDG": 4, "NTF": 401}

    def jid():
        v = f"JDG-S{nid['JDG']:04d}"; nid["JDG"] += 1; return v

    def ntf():
        v = f"NTF-{nid['NTF']:06d}"; nid["NTF"] += 1; return v

    # ── 1) 이행점검 회차 ──────────────────────────────────
    extra_cols["usf_round"] = ["insp_method", "outsource_org", "report_received_at"]
    extra_cols["notification"] = ["from_staff_id", "action_id", "batch_id"]
    rounds = {}
    for t, (h1c, h2c) in {"ws": ("2026-05-11", "2026-08-17"), "fc": ("2026-05-11", "2026-08-17"), "mt": ("2026-05-11", "2026-08-17")}.items():
        off = {"ws": 0, "fc": 20, "mt": 40}[t]
        keys = [k for k, _ in ITEMS[t]]
        r1 = {"round_id": f"{PFX[t]}-2026H1", "track": t, "title": f"2026년 상반기 이행점검({NAME[t]})",
              "dept_ids": ";".join(DEPT_H1[t]), "item_keys": ";".join(keys), "status": "결재완료",
              "created_by": "SD01-1", "created_at": ts(h1c, 9, off),
              "approved_by": "SD01-1", "approved_at": ts({"ws": "2026-06-24", "fc": "2026-06-25", "mt": "2026-06-26"}[t], 16, 30),
              "approve_note": {"ws": "상반기 점검 결과 확인 — 보완필요·미이행 부서는 하반기 1차 취합 때 재점검",
                               "fc": "정기안전점검 결과와 대조 확인 — 명령·재해 관련 보완 사항 하반기 재점검",
                               "mt": "수돗물·급식 원료 관리 확인 — 보완 사항은 하반기 1차 취합 때 재점검"}[t],
              "insp_method": "직접 점검" if t != "fc" else "위탁 점검",
              "outsource_org": "" if t != "fc" else "시설물 안전진단 전문기관(점검 용역)",
              "report_received_at": "" if t != "fc" else "2026-06-19"}
        r2 = {"round_id": f"{PFX[t]}-2026H2-1", "track": t, "title": f"2026년 하반기 이행점검({NAME[t]}) 1차",
              "dept_ids": ";".join(DEPT_H2[t]), "item_keys": ";".join(keys), "status": "점검중",
              "created_by": "SD01-1", "created_at": ts(h2c, 10, off),
              "approved_by": "", "approved_at": "", "approve_note": "",
              "insp_method": "", "outsource_org": "", "report_received_at": ""}
        new["usf_round"] += [r1, r2]
        rounds[t] = (r1, r2)

    judges = []   # 새 판정

    def judge(round_id, t, key, d, st, cm, at, by):
        j = {"judge_id": jid(), "round_id": round_id, "track": t, "item_key": key, "dept_id": d, "status": st,
             "comment": cm, "proposed": "", "basis": "", "judged_by": by, "judged_at": at}
        judges.append(j)
        if st in ("보완필요", "미이행"):
            day = at[:10]
            read = add_days(day, RNG.choice([1, 2, 3])) if day < "2026-09-20" else ""
            new["notification"].append({
                "notif_id": ntf(), "task_id": "", "notif_type": "조치요구", "to_staff_id": OWNER[d], "sent_at": day,
                "message": f"[이행점검 조치요구 · {NAME[t]}] {INO[t][key]}. {ILB[t][key]} — {st}: {cm}",
                "read_at": read, "note": "이행점검", "from_staff_id": by, "action_id": "", "batch_id": round_id,
            })
        return j

    h1_status = {}
    # 상반기 — 전 칸 판정(결재완료 회차라 판정 전 칸을 두지 않는다)
    for t in ["ws", "fc", "mt"]:
        r1 = rounds[t][0]
        k0 = 0
        for key, _ in ITEMS[t]:
            for d in DEPT_H1[t]:
                k0 += 1
                fx = FIXED.get(("H1", t, key, d))
                if fx:
                    st, cm = fx[0], fx[1]
                elif key in ("recur", "order"):
                    st, cm = "해당없음", T(d, key, "해당없음", t, "H1")
                elif t == "ws" and key == "org":
                    st = "이행완료" if d == "D01" else "해당없음"
                    cm = T(d, key, st, t, "H1")
                else:
                    st = pick([("이행완료", 0.78), ("보완필요", 0.16), ("미이행", 0.06)])
                    cm = T(d, key, st, t, "H1")
                day = fx[2] if fx else add_days("2026-05-18", (k0 * 3) % 25)
                at = ts(day, 9 + (k0 % 8), (k0 * 7) % 60)
                by = "SD01-1" if t == "ws" else "SD02-1"
                judge(r1["round_id"], t, key, d, st, cm, at, by)
                h1_status[(t, key, d)] = st

    # 하반기 1차 — 상반기에 보완필요·미이행이던 칸은 재점검(대부분 이행완료), 몇 칸은 판정하지 않고 둔다
    h2_status = {}
    for t in ["ws", "fc", "mt"]:
        r2 = rounds[t][1]
        k0 = 0
        for key, _ in ITEMS[t]:
            for d in DEPT_H2[t]:
                k0 += 1
                if (t, key) in SKIP_H2 and ("H2", t, key, d) not in FIXED:
                    continue
                fx = FIXED.get(("H2", t, key, d))
                if fx:
                    st, cm = fx[0], fx[1]
                elif key in ("recur", "order"):
                    if RNG.random() < 0.25:
                        continue            # 판정 전으로 둔다
                    st, cm = "해당없음", T(d, key, "해당없음", t, "H2")
                elif t == "ws" and key == "org":
                    st = "이행완료" if d == "D01" else "해당없음"
                    cm = T(d, key, st, t, "H2")
                else:
                    prev = h1_status.get((t, key, d))
                    if prev in ("보완필요", "미이행"):
                        st = pick([("이행완료", 0.70), ("보완필요", 0.30)])
                        cm = (f"상반기 지적({prev}) 보완 확인 — " + T(d, key, "이행완료", t, "H2")) if st == "이행완료" \
                            else f"상반기에 이어 다시 보완필요 — {T(d, key, '보완필요', t, 'H2')}"
                    else:
                        if RNG.random() < 0.12:
                            continue        # 판정 전으로 둔다
                        st = pick([("이행완료", 0.86), ("보완필요", 0.11), ("미이행", 0.03)])
                        cm = T(d, key, st, t, "H2")
                day = fx[2] if fx else add_days("2026-08-20", (k0 * 2) % 17)
                at = ts(day, 9 + (k0 % 8), (k0 * 11) % 60)
                by = "SD01-1" if t == "ws" else "SD02-1"
                judge(r2["round_id"], t, key, d, st, cm, at, by)
                h2_status[(t, key, d)] = (st, at)

    # 하반기 2차(기존 회차 RWS/RFC/RMT-2026H2 · 09-15 취합) — 1차의 보완필요·미이행 칸을 재점검. 그 밖의 칸은 1차 판정을 물려받는다.
    existing_keys = {("RWS-2026H2", "goal", "D03"), ("RWS-2026H2", "staff", "D09"), ("RFC-2026H2", "inspect", "D13"),
                     ("RWS-2026H2", "goal", "D01")}   # 기존 판정(seed 3 · 덮개 1)이 있는 칸 — 건드리지 않는다
    H2_2 = {"ws": ("RWS-2026H2", ["D01", "D02", "D03", "D09"]), "fc": ("RFC-2026H2", ["D03", "D04", "D13"]),
            "mt": ("RMT-2026H2", ["D04", "D07", "D14"])}
    k0 = 0
    for t, (rid, ds) in H2_2.items():
        by = "SD01-1" if t == "ws" else "SD02-1"
        for key, _ in ITEMS[t]:
            for d in ds:
                if (rid, key, d) in existing_keys:
                    continue
                k0 += 1
                prev = h2_status.get((t, key, d))
                day = add_days("2026-09-17", k0 % 8)
                at = ts(day, 10 + (k0 % 7), (k0 * 13) % 60)
                if prev and prev[0] in ("보완필요", "미이행") and not (key in ("recur", "order")):
                    if RNG.random() < 0.7:
                        judge(rid, t, key, d, "이행완료", f"1차 지적 보완 제출 확인(재점검) — {T(d, key, '이행완료', t, 'H2')}", at, by)
                elif (t, key) in SKIP_H2 and not prev:
                    st = pick([("이행완료", 0.75), ("보완필요", 0.25)])
                    judge(rid, t, key, d, st, T(d, key, st, t, "H2"), at, by)
    # 2차에만 있는 판정(명령·재해 — 1차 뒤에 생긴 것)
    judge("RWS-2026H2", "ws", "order", "D03", "해당없음", "하반기에 받은 산업안전 개선·시정명령 없음", ts("2026-09-22", 14, 5), "SD01-1")
    judge("RMT-2026H2", "mt", "order", "D04", "보완필요", "명령-012 정수시설 운영·관리 개선 명령(기한 09-27) — 역세척 펌프 교체 결과 제출", ts("2026-09-23", 10, 40), "SD02-1")
    judge("RMT-2026H2", "mt", "order", "D07", "미이행", "명령-024 집단급식소 보존식 시정명령 기한(09-24) 지남 — 이행 결과 미제출", ts("2026-09-25", 15, 20), "SD02-1")
    judge("RFC-2026H2", "fc", "recur", "D03", "보완필요", "사고-005 조명 전수 점검 70% 진행(이행 기한 10-31) — 점검표 추가 항목 반영 결과 제출", ts("2026-09-24", 11, 10), "SD02-1")
    new["usf_judge"] = judges

    # 기존 판정(seed) 중 보완필요 2건에 알림이 없었다 — 규칙대로 조치요구 알림을 붙인다(판정 행은 그대로)
    for (rid, t, key, d, st, cm, day, by) in [
        ("RWS-2026H2", "ws", "staff", "D09", "보완필요", "안전관리자 선임 통보서 업로드 필요", "2026-09-16", "SD02-1"),
        ("RFC-2026H2", "fc", "inspect", "D13", "보완필요", "하반기 안전점검 결과보고서 첨부 필요", "2026-09-16", "SD02-1"),
    ]:
        new["notification"].append({
            "notif_id": ntf(), "task_id": "", "notif_type": "조치요구", "to_staff_id": OWNER[d], "sent_at": day,
            "message": f"[이행점검 조치요구 · {NAME[t]}] {INO[t][key]}. {ILB[t][key]} — {st}: {cm}",
            "read_at": "2026-09-17", "note": "이행점검", "from_staff_id": by, "action_id": "", "batch_id": rid,
        })

    # ── 2) 유해·위험요인 개선 ─────────────────────────────
    hz_rows, hz_steps = build_hazards()
    new["hazard_report"] = hz_rows
    new["hazard_step"] = hz_steps

    # ── 3) 개선·시정명령 등 조치 ──────────────────────────
    inc, ordr, nil, rep, resp = build_recurrence()
    new["incident"] = inc
    new["order_received"] = ordr
    extra_cols["order_received"] = ["order_area"]
    new["incident_nil_check"] = nil
    new["incident_report"] = rep
    new["incident_response"] = resp

    # ── 4) 미이행 조치·재점검(과제 결재 기록 쪽) ──────────
    ins, act, nts = build_task_actions(judges, ntf)
    new["inspection"] = ins
    new["action"] = act
    new["notification"] += nts
    extra_cols["inspection"] = ["action_need"]
    extra_cols["action"] = ["task_id", "action_basis", "requested_by", "requested_at", "batch_id", "resubmit_note", "resubmitted_by", "started_at"]
    return new, extra_cols


# ── 유해·위험요인 ───────────────────────────────────────────
def build_hazards():
    rows, steps = [], []
    sid = [168]

    def step(hz, kind, at, by, memo):
        steps.append({"step_id": f"HZS-{sid[0]:04d}", "hz_id": hz, "step": kind, "at": at, "by": by, "memo": memo, "note": NOTE})
        sid[0] += 1

    def A(aid):
        a = AS[aid]
        return {"asset_id": aid, "asset_name": a["asset_name"], "asset_gbn": a["asset_gbn"], "asset_class": a["asset_class"], "dept_id": a["dept_id"]}

    def R(hz, recv, ch, chd, aid, loc, desc, cg, code, acc, poss, rep=None, **kw):
        a = A(aid)
        d = a["dept_id"]
        r = {"hz_id": hz, "received_at": recv, "channel": ch, "channel_detail": chd,
             "reporter": rep or ("시민" if ch == "시민 신고" else SN[OWNER[d]]), "received_by": OWNER[d], **a,
             "location": loc, "description": desc, "code_group": cg, "code": code, "accident_type": acc, "possible_accident": poss,
             "photo_wide": "", "photo_close": "", "note": NOTE}
        r.update(kw)
        rows.append(r)
        step(hz, "접수", recv, OWNER[d], ch + (f" · {chd}" if chd else ""))
        if r.get("protect_at"):
            step(hz, "피해방지조치", r["protect_at"], r["protect_by"], r["protect_action"])
        if r.get("judged_at"):
            step(hz, "1차 판단", r["judged_at"], r["judged_by"], r["severity"] + (f" · {r['judge_memo']}" if r.get("judge_memo") else ""))
        if r.get("closed_at"):
            step(hz, "즉시 조치·종결", r["closed_at"], r["closed_by"], r["minor_action"])
            if r.get("notified_reporter") == "Y":
                step(hz, "신고자 통보", r["notified_at"], r["closed_by"], "처리 결과 문자 통보")
        if r.get("ceo_reported_at"):
            step(hz, "경영책임자 보고", r["ceo_reported_at"], r["ceo_reported_by"], f"{r['ceo_report_mode']} · 지시: {r['ceo_instruction']}")
        if r.get("insp_at"):
            step(hz, "긴급안전점검", r["insp_at"], r["insp_by"], r["insp_result"])
        if r.get("order_at"):
            step(hz, "개선 지시", r["order_at"], "SM01-1", r["order_types"])
        if r.get("fix_items"):
            step(hz, "보수·보강 계획", r.get("plan_at", r["order_at"]), OWNER[d], r.get("fix_budget", ""))
        if r.get("fix_started_at"):
            step(hz, "보수·보강 착수", r["fix_started_at"], OWNER[d], "")
        if r.get("fix_done_at"):
            step(hz, "완료", r["fix_done_at"], OWNER[d], "보수·보강 완료")
        return r

    P = lambda at, by, what: {"protect_at": at, "protect_by": by, "protect_action": what}
    J = lambda sev, at, by, memo: {"severity": sev, "judged_at": at, "judged_by": by, "judge_memo": memo}

    # ① 접수만(방지 전) — 오늘·어제 들어온 신고
    R("HZR-0041", "2026-09-26 08:40", "시민 신고", "안전신문고", "BR1999-0000081", "오산천교 보도부 북측 난간",
      "보도 난간 하단 볼트 1개 탈락, 난간 흔들림", "시설물 안전", "3 부대시설", "떨어짐", "보행자가 기대다 난간과 함께 떨어짐")
    R("HZR-0042", "2026-09-25 17:30", "직원 발견", "", "AR2004-0004612", "평생학습관 2층 복도 천장",
      "천장 텍스 2장 처짐·누수 얼룩", "시설물 안전", "2 건축마감", "물체에 맞음", "천장재가 떨어져 이용자 맞음")
    # ② 피해방지까지(판단 전)
    R("HZR-0043", "2026-09-24 10:10", "정기점검", "", "ST2010-0000022", "수지레스피아 유입 펌프장 계단",
      "계단 디딤판 부식·일부 천공", "이용자 안전", "1 물리적", "넘어짐", "점검자 계단에서 발 빠짐·넘어짐",
      **P("2026-09-24 11:00", "SD05-1", "해당 계단 출입 통제 · 우회 동선 표시"))
    R("HZR-0044", "2026-09-23 15:20", "상시점검", "", "WS1991-0000015", "기흥상수도 배수지 점검구",
      "점검구 덮개 경첩 파손으로 덮개가 고정되지 않음", "이용자 안전", "5 기타", "떨어짐", "점검구 안으로 떨어짐",
      **P("2026-09-23 16:00", "SD04-1", "덮개 임시 결속 · 접근 금지 표지"))
    # ③ 경미 — 1차 판단 뒤 조치 중(개선) · 반복 신고 3회째
    R("HZR-0045", "2026-09-19 18:40", "시민 신고", "120", "AR2009-0002925", "시민체육센터 수영장 출입 통로",
      "출입 통로 바닥 물고임·미끄럼 — 같은 시설 넘어짐 신고 세 번째", "이용자 안전", "1 물리적", "넘어짐", "이용자 미끄러져 넘어짐",
      **P("2026-09-19 19:20", "SD09-1", "미끄럼 주의 표지 · 흡수 매트"), **J("경미", "2026-09-20 10:00", "SM02-2", "현장 조치 가능 · 반복 신고라 배수 구조 개선 검토"))
    R("HZR-0046", "2026-09-22 09:30", "상시점검", "", "TU2006-0000032", "마북터널 하행 비상대피 유도등",
      "비상 유도등 2개 소등", "이용자 안전", "3 전기적", "화재", "터널 화재 때 대피 방향을 찾지 못함",
      **P("2026-09-22 10:10", "SD03-1", "이동식 유도 표지 임시 설치"), **J("경미", "2026-09-22 13:00", "SM02-3", "현장 즉시 조치 가능"))
    # ④ 심각 — 판단 뒤 경영책임자 보고 전(보고 대기 · 24시간 넘김)
    R("HZR-0047", "2026-09-25 08:30", "정기점검", "", "RW2008-0000019", "용인보라도로옹벽 하단 배수구",
      "옹벽 하단 누수·토사 유출, 전면 균열 확대(폭 5mm)", "시설물 안전", "4 주변시설", "무너짐", "옹벽이 무너져 하부 보행자·차량 깔림",
      **P("2026-09-25 09:30", "SD03-1", "하부 보도 통제 · 우회 안내"), **J("심각", "2026-09-25 11:00", "SM02-2", "구조 안전 우려 — 경영책임자 보고 대상"))
    # ⑤ 심각 — 보고가 늦었던 건(30시간) · 긴급안전점검까지
    R("HZR-0048", "2026-09-10 14:00", "직원 발견", "", "BR1997-0000183", "보라횡단교 A2 교대 받침부",
      "교량 받침 이탈 흔적·신축이음 단차 5cm", "시설물 안전", "1 주요 구조부", "시설물 파손", "단차에 이륜차 넘어짐·상판 처짐",
      **P("2026-09-10 15:00", "SD03-2", "하위 1개 차로 통제 · 서행 표지"), **J("심각", "2026-09-10 16:00", "SM02-3", "구조 안전 우려 — 경영책임자 보고 대상"),
      ceo_reported_at="2026-09-11 22:00", ceo_report_mode="서면", ceo_reported_by="SM01-1", ceo_instruction="긴급안전점검 실시 · 보고 지연 사유 경위서 제출",
      insp_at="2026-09-15", insp_by="SD03-1", insp_result="받침 2개소 이탈 — 교체 필요, 상판 처짐은 허용범위")
    # ⑥ 심각 — 보수·보강 계획까지, 착수 기한(시설물안전법) 넘김
    R("HZR-0049", "2026-01-15 09:00", "정기점검", "", "RW2002-0000002", "이현중학교 앞 옹벽 중앙부",
      "옹벽 배부름 진행(20mm) — 2025년 정밀안전진단에서 보수·보강 대상으로 통보받았으나 착수 전", "시설물 안전", "4 주변시설", "무너짐",
      "옹벽이 무너져 통학로 학생 깔림",
      **P("2026-01-15 10:00", "SD03-1", "통학로 쪽 안전 펜스 · 우회 안내"), **J("심각", "2026-01-15 11:00", "SM02-2", "구조 안전 우려 — 경영책임자 보고 대상"),
      ceo_reported_at="2026-01-15 12:30", ceo_report_mode="구두 선보고 후 서면", ceo_reported_by="SM01-1", ceo_instruction="보수·보강 예산 확보 방안 보고",
      insp_at="2026-01-20", insp_by="SD03-1", insp_result="배부름 20mm·배수공 막힘 — 보강 필요(진단 결과와 같음)",
      order_types="보수·보강 · 이용제한(통학로 쪽 보도)", order_at="2026-01-22", order_memo="보수·보강 예산 확보 방안 보고",
      fsam_applies="Y", basis_date="2025-09-10", fix_items="배수공 준설·추가 천공~30개소~1200~착수 후 1개월 | 앵커 보강~40공~14500~착수 후 3개월",
      fix_budget="미확보 — 2027년 본예산 요청")
    # ⑦ 심각 — 보수·보강 계획, 착수 기한 60일 안
    R("HZR-0050", "2026-02-03 10:00", "정기점검", "", "TU2007-0000147", "역북터널 상행 120m 라이닝",
      "라이닝 균열 누수·백태 — 2025년 정밀안전점검 결과 보수·보강 통보 대상", "시설물 안전", "1 주요 구조부", "물체에 맞음", "라이닝 조각 떨어져 주행 차량 맞음",
      **P("2026-02-03 11:00", "SD03-1", "해당 구간 낙하물 감시 강화"), **J("심각", "2026-02-03 13:00", "SM02-3", "구조 안전 우려 — 경영책임자 보고 대상"),
      ceo_reported_at="2026-02-03 15:00", ceo_report_mode="서면", ceo_reported_by="SM01-1", ceo_instruction="우기 전 보수 착수 가능 여부 검토",
      insp_at="2026-02-10", insp_by="SD03-1", insp_result="균열 12m·누수 3개소 — 보수 필요, 긴급 통제는 불요",
      order_types="보수·보강", order_at="2026-02-12", order_memo="우기 전 보수 착수 가능 여부 검토",
      fsam_applies="Y", basis_date="2025-11-20", fix_items="균열 주입 보수~12m~2400~2026-10~11 | 누수 차단(도수 처리)~3개소~900~2026-11",
      fix_budget="확보(2026년 2회 추경)")
    # ⑧ 심각 — 전 단계 완료
    R("HZR-0051", "2026-03-18 10:30", "정기점검", "", "ST2005-0000049", "구갈레스피아 처리동 옥상 난간",
      "옥상 난간 기초 부식·흔들림", "시설물 안전", "3 부대시설", "떨어짐", "점검자 난간과 함께 떨어짐",
      **P("2026-03-18 11:00", "SD05-1", "옥상 출입 통제"), **J("심각", "2026-03-18 12:00", "SM02-2", "추락 위험 — 경영책임자 보고 대상"),
      ceo_reported_at="2026-03-18 14:00", ceo_report_mode="서면", ceo_reported_by="SM01-1", ceo_instruction="같은 형식 난간 전 처리장 점검",
      insp_at="2026-03-24", insp_by="SD05-1", insp_result="난간 기초 8개소 부식 — 교체 필요",
      order_types="이용제한 · 보수·보강", order_at="2026-03-25", order_memo="같은 형식 난간 전 처리장 점검",
      fsam_applies="N", basis_date="2026-03-25", fix_items="옥상 난간 교체~42m~3100~2026-04~05",
      fix_budget="확보(하수도 특별회계 시설유지비)", fix_started_at="2026-04-13", fix_done_at="2026-05-20", done_at="2026-05-20")
    # ⑨ 반복 — 용인미르스타디움 떨어짐(HZR-0040 에 이어 2·3번째)
    R("HZR-0052", "2026-07-26 19:40", "시민 신고", "응답소", "AR2018-0000223", "미르스타디움 서측 관람석 계단 손잡이",
      "계단 손잡이 고정부 흔들림", "시설물 안전", "3 부대시설", "떨어짐", "관람객 계단에서 떨어짐",
      **P("2026-07-26 20:20", "SD09-1", "해당 계단 통행 제한"), **J("경미", "2026-07-27 09:30", "SM02-2", "현장 즉시 조치 가능"),
      minor_action="손잡이 고정 볼트 재체결", closed_at="2026-07-29", closed_by="SD09-1", done_at="2026-07-29", notified_reporter="Y", notified_at="2026-07-29")
    R("HZR-0053", "2026-09-12 15:10", "상시점검", "", "AR2018-0000223", "미르스타디움 동측 관람석 통로 난간",
      "통로 난간 1경간 용접부 균열 — 같은 시설 떨어짐 위험 세 번째", "시설물 안전", "3 부대시설", "떨어짐", "관람객 난간과 함께 떨어짐",
      **P("2026-09-12 15:40", "SD09-1", "해당 구간 통제"), **J("경미", "2026-09-12 17:00", "SM02-3", "현장 조치 가능 · 반복 3회 — 난간 전수 점검 요청"),
      minor_action="용접부 보수 · 동측 난간 전수 육안 점검", closed_at="2026-09-16", closed_by="SD09-1", done_at="2026-09-16")
    # ⑩ 경미 — 시민 신고 즉시 조치·종결·신고자 통보
    R("HZR-0054", "2026-08-11 11:20", "시민 신고", "안전신문고", "AR2005-0003905", "복지센터 1층 승강기 앞",
      "바닥 타일 들뜸", "시설물 안전", "2 건축마감", "넘어짐", "휠체어·보행 보조기 이용자 걸려 넘어짐",
      **P("2026-08-11 12:00", "SD09-1", "들뜬 부위 표시·안내"), **J("경미", "2026-08-11 14:00", "SM02-2", "현장 즉시 조치 가능"),
      minor_action="타일 재부착", closed_at="2026-08-13", closed_by="SD09-1", done_at="2026-08-13", notified_reporter="Y", notified_at="2026-08-13")
    for r in rows:
        assert r["accident_type"] in ACC_TYPES, r["accident_type"]
    return rows, steps


ACC_TYPES = ["떨어짐", "넘어짐", "깔림·뒤집힘", "부딪힘", "물체에 맞음", "무너짐", "끼임", "절단·베임·찔림",
             "감전", "폭발·파열", "화재", "무리한 동작", "이상온도 접촉", "화학물질 누출", "산소결핍", "빠짐·익사",
             "교통사고(업무중)", "교통사고(업무 외)", "직업성 질병", "시설물 파손", "행사 등의 사고", "기타"]   # lib/acc_types.ts 와 같다(검증에서 대조)


# ── 재해·명령·무재해 확인 ─────────────────────────────────────
def build_recurrence():
    inc, ordr, nil, rep, resp = [], [], [], [], []
    base = {"note": NOTE}
    # 사고-011 — 중대산업재해(중대재해처벌법 제2조제2호나목) · 5단계 모두 끝남
    inc.append({**base, "incident_id": "INC-011", "occurred_at": "2026-04-14", "disaster_type": "중대산업재해", "asset_id": "", "dept_id": "D15",
                "summary": "가로등 보수 중 고소작업차 작업대가 기울어 작업자 2명 떨어짐",
                "cause": "아웃트리거를 다 펴지 않은 채 작업대 상승 · 작업 전 위험성평가 미실시 · 안전대 체결 확인 없음",
                "casualties": "부상 2명(2명 모두 6개월 이상 치료 진단)", "recurrence_plan": "고소작업차 작업 전 점검표(아웃트리거·지반) 의무화 · 작업허가제와 작업 전 위험성평가 · 안전대 체결 확인 · 운전원 재교육",
                "plan_due": "2026-07-31", "plan_done_at": "2026-07-24", "event_class": "산업재해", "event_area": "산업", "serious": "해당",
                "accident_type": "떨어짐", "place": "관내 도로 가로등 보수 현장", "basis_clause": "법 제4조제1항제2호 · 중대산업재해(법 제2조제2호나목)",
                "reported_by": "SD15-2", "owner_staff_id": "SD15-1", "cause_due": "2026-04-21", "investigated_at": "2026-04-20", "investigated_by": "SD15-1",
                "cause_evidence": "사고조사보고서_가로등보수_0414.pdf", "plan_set_due": "2026-05-06", "plan_set_at": "2026-04-30", "plan_set_by": "SM01-1",
                "plan_evidence": "재발방지대책_결재문서_고소작업차.pdf", "done_note": "작업 전 점검표·작업허가서 도입 · 운전원 6명 재교육 · 안전대 걸이 설비 보강",
                "done_evidence": "고소작업차_점검표_교육결과.pdf", "done_by": "SD15-1", "effect_due": "2026-09-30", "effect_checked_at": "2026-09-18",
                "effect_checked_by": "SM01-1", "effect_result": "유효", "effect_note": "8~9월 고소작업 18건 모두 점검표·작업허가 이행 확인, 추락 위험 지적 0건",
                "effect_evidence": "효과확인_고소작업_현장점검_202609.pdf", "related_order_id": "ORD-020", "check_note": ""})
    # 사고-012 — 아차사고(산업) · 이행 단계
    inc.append({**base, "incident_id": "INC-012", "occurred_at": "2026-06-17", "disaster_type": "아차사고", "asset_id": "", "dept_id": "D04",
                "summary": "약품 투입실 차아염소산나트륨 이송 배관 이음부 누설 — 작업자 접촉 직전 발견",
                "cause": "배관 이음부 패킹 노후 · 누설 감지기 없음", "casualties": "없음",
                "recurrence_plan": "이송 배관 패킹 전면 교체 · 누설 감지기와 방액턱 설치 · 약품 취급 보호구 비치",
                "plan_due": "2026-09-30", "plan_done_at": "", "event_class": "아차사고", "event_area": "산업", "serious": "해당 안 됨",
                "accident_type": "화학물질 누출", "place": "용인정수장(상수도사업소 정수과) 약품 투입실", "basis_clause": "법정 대상 아님 — 예방 기록(위험성평가 반영)",
                "reported_by": "SD04-2", "owner_staff_id": "SD04-1", "cause_due": "2026-06-24", "investigated_at": "2026-06-22", "investigated_by": "SD04-1",
                "cause_evidence": "약품배관_누설_조사서.pdf", "plan_set_due": "2026-07-03", "plan_set_at": "2026-07-01", "plan_set_by": "SM02-1",
                "plan_evidence": "약품실_누설방지_계획.pdf", "check_note": ""})
    # 사고-013 — 공중이용시설 이용자 피해(중대시민재해 아님) · 대책 기한 넘김
    inc.append({**base, "incident_id": "INC-013", "occurred_at": "2026-08-29", "disaster_type": "시민 피해 사고", "asset_id": "AR2009-0002925", "dept_id": "D09",
                "summary": "수영장 출입 통로에서 이용자가 미끄러져 넘어짐 — 손목 골절",
                "cause": "통로 배수 구배 부족으로 물고임 · 같은 곳 넘어짐 위험 신고 2회(신고-0005·0031)에 즉시 조치만 하고 구조 개선은 하지 않음",
                "casualties": "부상 1명(손목 골절, 치료 6주)", "recurrence_plan": "", "plan_due": "", "plan_done_at": "",
                "event_class": "시민재해", "event_area": "시민", "serious": "해당 안 됨", "accident_type": "넘어짐", "place": "수영장 출입 통로",
                "basis_clause": "법 제9조제2항제2호 — 중대시민재해 기준(법 제2조제3호) 미달, 재발방지 기록",
                "reported_by": "SD09-2", "owner_staff_id": "SD09-1", "cause_due": "2026-09-05", "investigated_at": "2026-09-04", "investigated_by": "SD09-1",
                "cause_evidence": "수영장통로_넘어짐_조사서.pdf", "plan_set_due": "2026-09-18", "check_note": ""})
    # 사고-014 — 아차사고(원료·제조물) · 대책 수립 단계
    inc.append({**base, "incident_id": "INC-014", "occurred_at": "2026-09-09", "disaster_type": "아차사고", "asset_id": "", "dept_id": "D14",
                "summary": "학교급식 납품 예정 시금치 잔류농약 기준 초과 — 납품 전 검사에서 발견해 전량 공급 중지",
                "cause": "계약 농가 출하 전 자가검사 누락", "casualties": "없음", "recurrence_plan": "", "plan_due": "", "plan_done_at": "",
                "event_class": "아차사고", "event_area": "시민", "serious": "해당 안 됨", "accident_type": "기타", "place": "학교급식 식재료 검사실",
                "basis_clause": "법정 대상 아님 — 예방 기록(원료·제조물)", "reported_by": "SD14-2", "owner_staff_id": "SD14-1",
                "cause_due": "2026-09-16", "investigated_at": "2026-09-15", "investigated_by": "SD14-1", "cause_evidence": "잔류농약_부적합_경위서.pdf",
                "plan_set_due": "2026-09-30", "check_note": ""})
    # 사고-015 — 산업재해(3일 이상 휴업) · 원인 조사 단계
    inc.append({**base, "incident_id": "INC-015", "occurred_at": "2026-09-23", "disaster_type": "산업재해", "asset_id": "", "dept_id": "D17",
                "summary": "하천 제초 작업 중 예초기 날 파편이 튀어 작업자 다리 베임",
                "cause": "", "casualties": "부상 1명(다리 열상, 치료 2주)", "recurrence_plan": "", "plan_due": "", "plan_done_at": "",
                "event_class": "산업재해", "event_area": "산업", "serious": "해당 안 됨", "accident_type": "절단·베임·찔림", "place": "경안천 제방 제초 구간",
                "basis_clause": "법 제4조제1항제2호", "reported_by": "SD17-2", "owner_staff_id": "SD17-1", "cause_due": "2026-09-30", "check_note": ""})

    # 대응 기록 — 재해(아차사고 아님)는 보고·긴급 조치를 남긴다(시행령 제4조제8호 · 제10조제7호다목 — response.ts)
    rid, pid = [29], [10]

    def RS(inc_id, kind, status, at, by, detail, org="", ev=""):
        resp.append({"resp_id": f"IRS-{rid[0]:03d}", "incident_id": inc_id, "kind": kind, "status": status, "done_at": at, "done_by": by,
                     "target_org": org, "detail": detail, "evidence_name": ev, "evidence_url": "", "proxy": "", "recorded_by": by, "recorded_at": at, "note": NOTE})
        rid[0] += 1

    def RP(inc_id, stage, at, by, rec, ov, dmg="", rsc="", rcv="", nxt="", agency="", ack="", ev="", ch="전화", seq=""):
        rep.append({"report_id": f"IRP-{pid[0]:03d}", "incident_id": inc_id, "report_stage": stage, "seq": seq, "reported_at": at, "reporter_staff_id": by,
                    "recipients": rec, "agency_name": agency, "channel": ch, "overview": ov, "damage": dmg, "rescue": rsc, "recovery": rcv, "support": "",
                    "next_plan": nxt, "evidence_name": ev, "evidence_url": "", "ceo_ack_at": ack, "ceo_ack_by": "CEO-1" if ack else "",
                    "ceo_ack_proxy": "", "ceo_ack_recorded_by": "CEO-1" if ack else "", "recorded_by": by, "recorded_at": at, "note": NOTE})
        pid[0] += 1

    # INC-011(중대산업재해)
    RS("INC-011", "recognize", "완료", "2026-04-14 10:20", "SD15-2", "작업반장 전화 — 고소작업차 작업대 기울어 작업자 2명 떨어짐")
    RS("INC-011", "call", "완료", "2026-04-14 10:22", "SD15-2", "119 구급 요청 — 2명 병원 이송 · 112 교통 통제 요청", "119")
    RS("INC-011", "restrict", "완료", "2026-04-14 10:25", "SD15-2", "고소작업차 이용 작업 전부 중지 · 작업자 대피")
    RS("INC-011", "rescue", "완료", "2026-04-14 10:30", "SD15-2", "현장 응급처치 · 병원 이송 동행 · 가족 연락")
    RS("INC-011", "sign", "완료", "2026-04-14 11:00", "SD15-1", "사고 지점 차로 통제 · 위험 표지", "사고 현장 차로", "통제_설치사진_0414.jpg")
    RS("INC-011", "inspect", "완료", "2026-04-14 15:00", "SD15-1", "보유 고소작업차 4대 긴급 점검 — 아웃트리거 센서 고장 1대 사용 중지", "", "고소작업차_긴급점검표_0414.pdf")
    RS("INC-011", "agency", "완료", "2026-04-14 11:30", "SD15-1", "중대재해 발생 보고(산업안전보건법 제54조제2항 — 지체 없이)", "고용노동부 경기지청")
    RS("INC-011", "press", "완료", "2026-04-14 13:00", "SD15-1", "언론 창구를 도로건설과장 한 사람으로 지정")
    RS("INC-011", "ceo_prevent", "지시", "2026-04-14 11:10", "CEO-1", "고소작업차 이용 작업 전면 중지 · 전 부서 고소작업 장비 점검", "SD15-1")
    RS("INC-011", "ceo_cause", "지시", "2026-04-15 09:00", "CEO-1", "원인 조사 — 작업 전 위험성평가·작업허가 여부 포함, 1주 안에 보고", "SD15-1")
    RP("INC-011", "최초보고", "2026-04-14 10:40", "SD15-1", "경영책임자 · 총괄",
       "04-14 10:15경 가로등 보수 중 고소작업차 작업대 기울어 작업자 2명 떨어짐 · 담당 도로건설과", "부상 2명(중상 추정)", "119 이송", "고소작업 중지",
       ack="2026-04-14 10:45")
    RP("INC-011", "직후보고", "2026-04-14 13:30", "SD15-1", "경영책임자 · 총괄 · 관계 행정기관",
       "진단 결과 2명 모두 골절 — 6개월 이상 치료 예상, 중대산업재해 해당", "부상 2명", "", "현장 보존 · 작업 중지 유지", "원인 조사 착수 · 산업재해조사표 준비",
       agency="고용노동부 경기지청", ch="서면", ev="상황보고_2보_가로등보수.hwp")
    RP("INC-011", "수시보고", "2026-04-16 09:00", "SD15-1", "경영책임자 · 총괄", "고용노동부 작업중지 명령 접수(명령-020) · 해제 요청 준비",
       nxt="작업 전 점검표·작업허가서 마련", ch="서면", seq="1")
    # INC-013(시민 피해 사고)
    RS("INC-013", "recognize", "완료", "2026-08-29 16:05", "SD09-2", "안전요원 무전 — 수영장 출입 통로 이용자 넘어짐")
    RS("INC-013", "call", "완료", "2026-08-29 16:08", "SD09-2", "119 구급 요청", "119")
    RS("INC-013", "rescue", "완료", "2026-08-29 16:10", "SD09-2", "현장 응급처치 · 보호자 연락")
    RS("INC-013", "sign", "완료", "2026-08-29 16:20", "SD09-2", "통로 미끄럼 주의 표지 · 흡수 매트", "수영장 출입 통로")
    RS("INC-013", "restrict", "완료", "2026-08-29 16:20", "SD09-2", "해당 통로 일시 폐쇄 · 옆 통로로 안내")
    RS("INC-013", "inspect", "완료", "2026-08-29 18:00", "SD09-1", "수영장 전 통로 바닥 긴급 점검 — 물고임 2곳 추가", "", "수영장통로_긴급점검표_0829.pdf")
    RS("INC-013", "notify", "완료", "2026-08-30 09:00", "SD09-1", "센터 게시판·누리집 — 통로 일부 폐쇄 안내", "시설 게시판")
    RS("INC-013", "agency", "해당 없음", "2026-08-30 09:00", "SD09-1", "중대시민재해 기준 미달 — 관계 행정기관 신고 대상 아님(기록만)")
    RS("INC-013", "press", "해당 없음", "2026-08-30 09:00", "SD09-1", "언론 문의 없음 — 문의가 오면 건축과장이 창구")
    RS("INC-013", "ceo_cause", "지시", "2026-08-30 10:00", "CEO-1", "같은 곳 신고가 두 번 있었는데 사고가 난 이유를 원인 조사에 포함", "SD09-1")
    RP("INC-013", "최초보고", "2026-08-29 16:40", "SD09-1", "경영책임자 · 총괄", "08-29 16:00경 시민체육센터 수영장 통로 이용자 넘어짐 · 손목 부상 · 담당 건축과",
       "부상 1명", "119 이송", "통로 일시 폐쇄", ack="2026-08-29 17:05")
    RP("INC-013", "직후보고", "2026-08-29 19:00", "SD09-1", "경영책임자 · 총괄", "진단 결과 손목 골절(치료 6주) — 같은 곳 넘어짐 신고 2회 이력 확인",
       "부상 1명", "", "통로 폐쇄 유지", "원인 조사 · 배수 구조 개선 검토", ch="서면")
    # INC-015(산업재해)
    RS("INC-015", "recognize", "완료", "2026-09-23 10:40", "SD17-2", "작업반 전화 — 예초 작업자 다리 부상")
    RS("INC-015", "call", "해당 없음", "2026-09-23 10:42", "SD17-2", "거동 가능 — 동료 차량으로 병원 이동")
    RS("INC-015", "restrict", "완료", "2026-09-23 10:45", "SD17-2", "해당 구간 예초 작업 중지")
    RS("INC-015", "rescue", "완료", "2026-09-23 10:50", "SD17-2", "지혈 · 병원 이송 동행")
    RS("INC-015", "sign", "완료", "2026-09-23 11:00", "SD17-2", "작업 구간 출입 금지 표지", "경안천 제방")
    RS("INC-015", "inspect", "완료", "2026-09-23 15:00", "SD17-1", "보유 예초기 12대 날·덮개 점검 — 날 교체 3대", "", "예초기_긴급점검표_0923.pdf")
    RS("INC-015", "agency", "완료", "2026-09-24 09:00", "SD17-1", "3일 이상 휴업 — 산업재해조사표 1개월 안 제출 예정(산업안전보건법 시행규칙 제73조제1항)", "고용노동부 경기지청")
    RS("INC-015", "press", "해당 없음", "2026-09-24 09:00", "SD17-1", "언론 문의 없음")
    RS("INC-015", "ceo_cause", "지시", "2026-09-24 10:00", "CEO-1", "원인 조사 — 예초기 날 점검 주기와 보안면 착용 여부", "SD17-1")
    RP("INC-015", "최초보고", "2026-09-23 11:10", "SD17-1", "경영책임자 · 총괄", "09-23 10:30경 경안천 제방 예초 작업 중 날 파편에 작업자 다리 베임 · 담당 생태하천과",
       "부상 1명", "병원 이송", "예초 작업 중지", ack="2026-09-23 11:30")
    RP("INC-015", "직후보고", "2026-09-23 16:00", "SD17-1", "경영책임자 · 총괄", "진단 결과 열상 봉합 · 치료 2주(3일 이상 휴업)", "부상 1명", "", "작업 중지 유지",
       "원인 조사 09-30까지 · 산업재해조사표 제출", ch="서면")

    # 명령 — 재해 구분(order_area)을 채운다(법 제4조제1항제3호 · 제9조제2항제3호 · 제9조제1항제3호)
    ob = {"note": NOTE, "doc_nature": "서면 행정처분", "check_note": "", "evidence_file": "", "extended_due": "", "extend_reason": "", "place": ""}
    ordr += [
        {**ob, "order_id": "ORD-020", "received_at": "2026-04-14", "issuer": "고용노동부(경기지청)", "law": "산업안전보건법",
         "content": "중대재해 발생 — 고소작업차 이용 작업 작업중지 명령", "due_date": "2026-05-14", "dept_id": "D15", "asset_id": "", "done_at": "2026-05-02",
         "result": "조치 완료", "issuer_kind": "중앙행정기관", "law_article": "산업안전보건법 제55조제1항", "order_no": "경기지청-2026-0414",
         "owner_staff_id": "SD15-1", "assigned_at": "2026-04-14", "action_plan": "작업 전 점검표·작업허가 절차 마련 뒤 작업중지 해제 요청",
         "started_at": "2026-04-16", "done_note": "점검표·작업허가 절차 마련 · 고소작업차 정비 · 작업중지 해제 요청", "done_by": "SD15-1",
         "reported_at": "2026-05-03", "report_evidence": "작업중지_해제요청서.pdf", "closed_at": "2026-05-10", "closed_note": "작업중지 해제 통보 접수",
         "related_incident_id": "INC-011", "place": "관내 도로 가로등 보수 현장", "order_area": "산업"},
        {**ob, "order_id": "ORD-021", "received_at": "2026-09-14", "issuer": "국토교통부", "law": "시설물의 안전 및 유지관리에 관한 특별법",
         "content": "정밀안전진단 결과 보수·보강 미착수 — 보수·보강 이행 명령(이현중학교 앞 옹벽)", "due_date": "2026-10-14", "dept_id": "D03",
         "asset_id": "RW2002-0000002", "done_at": "", "result": "조치 중", "issuer_kind": "중앙행정기관",
         "law_article": "시설물의 안전 및 유지관리에 관한 특별법 제24조제2항", "order_no": "국토부-시설안전-2026-0914",
         "owner_staff_id": "SD03-1", "assigned_at": "2026-09-15", "action_plan": "긴급 예산 전용으로 배수공 준설 선착수 · 앵커 보강 발주",
         "started_at": "2026-09-21", "done_note": "", "done_by": "", "reported_at": "", "report_evidence": "", "closed_at": "", "closed_note": "",
         "related_incident_id": "", "order_area": "시민"},
        {**ob, "order_id": "ORD-022", "received_at": "2026-06-10", "issuer": "용인소방서", "law": "화재의 예방 및 안전관리에 관한 법률",
         "content": "화재안전조사 결과 옥내소화전 방수압 미달 — 소방시설 개수 명령", "due_date": "2026-07-10", "dept_id": "D09",
         "asset_id": "AR2010-0002931", "done_at": "2026-07-03", "result": "조치 완료", "issuer_kind": "지방자치단체",
         "law_article": "화재의 예방 및 안전관리에 관한 법률 제14조제1항", "order_no": "용인소방-2026-0610",
         "owner_staff_id": "SD09-1", "assigned_at": "2026-06-11", "action_plan": "가압펌프 정비 · 배관 누수 보수", "started_at": "2026-06-15",
         "done_note": "가압펌프 정비·배관 보수 · 방수압 재측정 기준 이내", "done_by": "SD09-1", "reported_at": "2026-07-06",
         "report_evidence": "소방시설_개수결과_보고.pdf", "closed_at": "2026-07-20", "closed_note": "소방서 현장 확인", "related_incident_id": "", "order_area": "시민"},
        {**ob, "order_id": "ORD-023", "received_at": "2026-03-09", "issuer": "기후에너지환경부", "law": "수도법",
         "content": "정수처리기준(탁도) 미준수 — 여과지 운영 개선 등 필요한 조치 명령", "due_date": "2026-04-08", "dept_id": "D04",
         "asset_id": "WS2003-0000053", "done_at": "2026-04-02", "result": "조치 완료", "issuer_kind": "중앙행정기관",
         "law_article": "수도법 제28조제8항", "order_no": "기후부-수도-2026-0309", "owner_staff_id": "SD04-1", "assigned_at": "2026-03-10",
         "action_plan": "여과지 역세척 주기 조정 · 탁도계 교정", "started_at": "2026-03-12", "done_note": "역세척 주기 조정 · 탁도계 2대 교정 · 4주 연속 기준 이내",
         "done_by": "SD04-1", "reported_at": "2026-04-03", "report_evidence": "정수처리기준_개선결과_보고.pdf", "closed_at": "2026-04-20",
         "closed_note": "발령기관 이행 확인 공문 접수", "related_incident_id": "", "order_area": "원료·제조물"},
        {**ob, "order_id": "ORD-024", "received_at": "2026-09-17", "issuer": "처인구청", "law": "식품위생법",
         "content": "시립어린이집 집단급식소 보존식 보관 기준(144시간 이상) 미준수 — 시정명령", "due_date": "2026-09-24", "dept_id": "D07",
         "asset_id": "", "done_at": "", "result": "조치 중", "issuer_kind": "지방자치단체", "law_article": "식품위생법 제71조제1항",
         "order_no": "처인구-위생-2026-0917", "owner_staff_id": "SD07-1", "assigned_at": "2026-09-17", "action_plan": "보존식 전용 냉동고 구입 · 보관 기록부 도입",
         "started_at": "2026-09-19", "done_note": "", "done_by": "", "reported_at": "", "report_evidence": "", "closed_at": "", "closed_note": "",
         "related_incident_id": "", "place": "처인구 소재 시립어린이집", "order_area": "원료·제조물"},
        {**ob, "order_id": "ORD-025", "received_at": "2026-09-22", "issuer": "고용노동부(경기지청)", "law": "산업안전보건법",
         "content": "재활용 선별동 파쇄기 투입구 방호덮개 미설치 — 시정조치 명령", "due_date": "2026-10-22", "dept_id": "D12",
         "asset_id": "", "done_at": "", "result": "접수", "issuer_kind": "중앙행정기관", "law_article": "산업안전보건법 제53조제1항",
         "order_no": "경기지청-2026-0922", "owner_staff_id": "", "assigned_at": "", "action_plan": "", "started_at": "", "done_note": "", "done_by": "",
         "reported_at": "", "report_evidence": "", "closed_at": "", "closed_note": "", "related_incident_id": "", "place": "용인환경센터 재활용 선별동", "order_area": "산업"},
        {**ob, "order_id": "ORD-026", "received_at": "2026-09-01", "issuer": "경기도", "law": "재난 및 안전관리 기본법",
         "content": "긴급안전점검 결과 교대부 세굴 — 보수·보강 등 정비 안전조치 명령(오산천교)", "due_date": "2026-10-01", "dept_id": "D03",
         "asset_id": "BR1999-0000081", "done_at": "", "result": "조치 중", "issuer_kind": "지방자치단체", "law_article": "재난 및 안전관리 기본법 제31조제1항",
         "order_no": "경기도-안전-2026-0901-2", "owner_staff_id": "SD03-2", "assigned_at": "2026-09-02", "action_plan": "세굴 부위 사석 보강 · 교대 기초 보호공",
         "started_at": "2026-09-08", "done_note": "", "done_by": "", "reported_at": "", "report_evidence": "", "closed_at": "", "closed_note": "",
         "related_incident_id": "", "order_area": "시민"},
        {**ob, "order_id": "ORD-027", "received_at": "2026-08-18", "issuer": "고용노동부(경기지청)", "law": "산업안전보건법",
         "content": "승용식 잔디깎기 기계 회전날 덮개 파손 — 사용중지 및 개선 시정조치 명령", "due_date": "2026-09-17", "dept_id": "D06",
         "asset_id": "", "done_at": "2026-09-12", "result": "조치 완료", "issuer_kind": "중앙행정기관", "law_article": "산업안전보건법 제53조제1항",
         "order_no": "경기지청-2026-0818", "owner_staff_id": "SD06-1", "assigned_at": "2026-08-19", "action_plan": "회전날 덮개 교체 · 시정조치 명령 사항 게시(같은 조 제2항)",
         "started_at": "2026-08-24", "done_note": "덮개 교체 · 명령 사항 게시 · 사용중지 해제 요청 준비", "done_by": "SD06-1", "reported_at": "", "report_evidence": "",
         "closed_at": "", "closed_note": "", "related_incident_id": "", "place": "공원 잔디 관리 작업장", "order_area": "산업"},
    ]

    # 반기 무재해 확인(재해 발생 이력 없음) — 상반기 미확인 부서 대부분 · 하반기(진행) 일부
    k = [15]

    def N(period, d, at, by=None):
        nil.append({"nil_id": f"NIL-{k[0]:03d}", "period": period, "dept_id": d, "confirmed_by": by or OWNER[d], "confirmed_at": at,
                    "memo": "확인 시점까지 부서 내 재해 발생 없음", "note": NOTE})
        k[0] += 1
    for d, at in [("D11", "2026-07-03"), ("D16", "2026-07-02"), ("D17", "2026-07-07"), ("D18", "2026-07-03"),
                  ("D19", "2026-07-08"), ("D20", "2026-07-06"), ("D22", "2026-07-02"), ("D23", "2026-07-09")]:
        N("2026-H1", d, at)
    for d, at in [("D11", "2026-09-15"), ("D15", "2026-09-16"), ("D18", "2026-09-17"), ("D20", "2026-09-18"), ("D22", "2026-09-14"), ("D23", "2026-09-16")]:
        N("2026-H2", d, at)
    return inc, ordr, nil, rep, resp


# ── 미이행 조치·재점검 — 과제 결재 기록 쪽(BAT-003 · 2026 하반기) ─────────────
def build_task_actions(judges, ntf):
    """
    기존 과제(값은 그대로)에 판정·조치 기록만 더한다.
      A 「보완 제출」 — 1차 보완필요 → 조치 요구 → 부서 보완 제출(과제는 이미 「제출」 · 부서장 확인 전) → 재점검 대기
      B 「완료」     — 1차 보완필요 → 조치 요구 → 보완 제출 → 부서장 확인 → 같은 부서·항목 이행점검 「이행완료」 판정(재점검)으로 닫힘
    고르는 규칙(재현 가능): BAT-003 범위(의무조항·부서·2026 하반기) · 판정·조치 기록 없음 · 덮개에 없음 ·
      A 는 부서장 확인 없음 + 뒤에 그 부서·항목 「이행완료」 판정 없음, B 는 부서장 확인 있음 + 제출일 뒤 「이행완료」 판정 있음.
    """
    def rd(ver, t):
        return read(ver, t)[1]
    T_ = rd("ops_v2.2_20260924", "compliance_task")
    A_ = {r["assign_id"]: r for r in rd("ops_v2.0_20260924", "duty_assignment")}
    D_ = {r["duty_key"]: r for r in rd("ops_v1.3_20260924", "duty_class")}
    P_ = {r["task_id"]: r for r in rd("ops_v2.2_20260924", "task_approval_patch")}
    has_ins = {r["task_id"] for r in rd("ops_v2.2_20260924", "inspection")}
    ov = set(OVERLAY.get("taskPatch", {})) | {r["task_id"] for r in OVERLAY.get("inspection", [])}
    bat = {r["batch_id"]: r for r in rd("ops_v0.3_20260921", "inspection_batch")}["BAT-003"]
    codes, depts = bat["code36_list"].split(","), bat["target_dept_ids"].split(",")
    # 항목(이행점검) ↔ 의무조항 — app/check/_lib.ts itemsOf codes 와 같다
    ITEM_CODES = {"ws": {"goal": ["I01"], "org": ["I02"], "staff": ["I06"], "risk": ["I03"], "budget": ["I04"], "work": ["I05"], "opinion": ["I07"],
                         "emergency": ["I08"], "recur": ["I10"], "order": ["I11"], "law": ["I12"], "edu": ["I13"]},
                  "fc": {"staff": ["F01"], "budget": ["F02"], "inspect": ["F03"], "plan": ["F04", "F05", "F06"], "proc": ["F07"], "recur": ["F09"],
                         "order": ["F10"], "law": ["F11", "F12"]},
                  "mt": {"staff": ["M01"], "budget": ["M02"], "proc": ["M04", "M03", "M05"], "recur": ["M06"], "order": ["M07"], "law": ["M08", "M09"]}}
    TR = {"I": "ws", "F": "fc", "M": "mt"}

    def item_of(code):
        t = TR.get(code[:1])
        for k, cs in ITEM_CODES.get(t, {}).items():
            if code in cs:
                return t, k
        return None, None

    # 하반기 이행점검 판정(기존 seed 판정 + 새 판정) — (대상,항목,부서) → [(판정일, 상태)]
    _, old_j = read("us_v1.0_20260924", "usf_judge")
    h2rounds = {"RWS-2026H2", "RFC-2026H2", "RMT-2026H2", "RWS-2026H2-1", "RFC-2026H2-1", "RMT-2026H2-1"}
    jl = defaultdict(list)
    for j in old_j + judges:
        if j["round_id"] in h2rounds:
            jl[(j["track"], j["item_key"], j["dept_id"])].append((j["judged_at"][:10], j["status"]))

    cand_a, cand_b = [], []
    for t in T_:
        a = A_.get(t["assign_id"], {})
        d = D_.get(a.get("duty_key"), {})
        p = P_.get(t["task_id"], {})
        code = (d.get("code36") or "").split(";")[0].strip()
        if code not in codes or a.get("dept_id") not in depts or p.get("period_year") != "2026" or p.get("half_year") != "하반기":
            continue
        if a.get("applicability") == "비해당" or t["task_id"] in has_ins or t["task_id"] in ov or p.get("approval_status") != "제출":
            continue
        sub = (p.get("submitted_at") or "")[:10]
        if not sub or sub < "2026-07-15" or sub > "2026-09-22" or not (d.get("duty_name") or "").strip():
            continue
        tr, key = item_of(code)
        if not tr:
            continue
        later_ok = [x for x in jl.get((tr, key, a["dept_id"]), []) if x[1] == "이행완료" and x[0] >= sub]
        row = (t["task_id"], a["dept_id"], code, d.get("duty_name"), sub, a.get("owner_staff_id") or OWNER[a["dept_id"]], later_ok, p)
        if not p.get("head_ok_at"):
            # A — 뒤에 그 부서·항목 이행완료 판정이 전혀 없어야 「보완 제출」로 남는다
            if not [x for x in jl.get((tr, key, a["dept_id"]), []) if x[1] == "이행완료" and x[0] >= add_days(sub, -30)]:
                cand_a.append(row)
        elif later_ok:
            cand_b.append(row)

    def spread(c, n):
        # 부서가 한쪽에 몰리지 않게(부서마다 둘까지) 제출일 순으로
        out, seen = [], Counter()
        for r in sorted(c, key=lambda x: (x[4], x[0])):
            if seen[r[1]] >= 2 or any(o[2] == r[2] and o[1] == r[1] for o in out):
                continue
            out.append(r); seen[r[1]] += 1
            if len(out) == n:
                break
        return out
    pa, pb = spread(cand_a, 4), spread(cand_b, 3)
    if os.environ.get("DBG"):
        print("후보 A", [(r[0], r[1], r[2], r[4]) for r in cand_a], "B", len(cand_b), [(r[0], r[1], r[2], r[4]) for r in pb])
    ins, act, nts = [], [], []
    ii, ai = [213], [44]
    FIND = ["증빙 사진에 촬영 일자·위치가 없음 — 다시 촬영해 제출", "점검표 서명 누락 — 서명 뒤 다시 제출",
            "결과보고서 첨부가 계획서로 잘못 올라옴 — 결과보고서 제출", "기준 수치 확인 자료(측정 기록) 없음"]
    for n, (tid, d, code, duty, sub, owner, later_ok, p) in enumerate(pa + pb):
        idate = add_days(sub, -12)
        insp_id = f"INS-{ii[0]:06d}"; ii[0] += 1
        ins.append({"insp_id": insp_id, "task_id": tid, "inspector_staff_id": "SM02-2" if n % 2 else "SM02-3", "insp_date": idate,
                    "result": "보완필요", "finding": FIND[n % len(FIND)], "note": NOTE, "action_need": "보완"})
        act_id = f"ACT-{ai[0]:06d}"; ai[0] += 1
        req = add_days(idate, 1)
        act.append({"action_id": act_id, "insp_id": insp_id, "action_type": "보완", "due_date": add_days(req, 14), "done_at": sub,
                    "result": "보완 제출", "note": "조치 요구", "task_id": tid, "action_basis": "", "requested_by": "SD01-1", "requested_at": req,
                    "batch_id": "BAT-003", "resubmit_note": "지적 사항 보완 — 증빙 다시 올림", "resubmitted_by": owner, "started_at": add_days(req, 2)})
        nts.append({"notif_id": ntf(), "task_id": tid, "notif_type": "조치요구", "to_staff_id": owner, "sent_at": req,
                    "message": f"[조치요구 · 보완] {duty} — 보완필요: {FIND[n % len(FIND)]} · 기한 {add_days(req, 14)}",
                    "read_at": add_days(req, 1), "note": "", "from_staff_id": "SD01-1", "action_id": act_id, "batch_id": "BAT-003"})
        nts.append({"notif_id": ntf(), "task_id": tid, "notif_type": "재점검요청", "to_staff_id": ins[-1]["inspector_staff_id"], "sent_at": sub,
                    "message": f"[재점검요청] {duty} — 보완 제출(2차 판정 대기): 지적 사항 보완 — 증빙 다시 올림",
                    "read_at": "", "note": "", "from_staff_id": owner, "action_id": "", "batch_id": "BAT-003"})
    return ins, act, nts,


# ── 쓰기·검증 ─────────────────────────────────────────────
def main():
    new, extra = build()
    os.makedirs(OUT, exist_ok=True)
    report = {}
    acc_ts = open(os.path.join(APP, "lib", "acc_types.ts"), encoding="utf-8").read()
    for a in ACC_TYPES:
        assert f'"{a}"' in acc_ts, f"재해유형 목록이 lib/acc_types.ts 와 다름: {a}"
    for table, src in SRC.items():
        assert latest(table) == src, f"{table}: 앱이 읽는 판이 {latest(table)} 인데 {src} 로 적었다"
        fields, old = read(src, table)
        key = KEY[table]
        add = new.get(table, [])
        cols = list(fields) + [c for c in extra.get(table, []) if c not in fields]
        for r in add:
            for c in r:
                if c not in cols:
                    cols.append(c)
        # id 겹침 검사 — 기존 판 · 덮개
        old_ids = {r[key] for r in old}
        ov = ov_ids(table, key)
        for r in add:
            assert r[key] not in old_ids, f"{table} id 겹침(기존): {r[key]}"
            assert r[key] not in ov, f"{table} id 겹침(덮개): {r[key]}"
        assert len({r[key] for r in add}) == len(add), f"{table} 새 id 중복"
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=cols, extrasaction="raise", lineterminator="\r\n")
        w.writeheader()
        for r in old:
            w.writerow({c: r.get(c, "") for c in cols})
        for r in add:
            w.writerow({c: r.get(c, "") for c in cols})
        p = os.path.join(OUT, table + ".csv")
        with open(p, "w", encoding="utf-8-sig", newline="") as f:
            f.write(buf.getvalue())
        # 다시 읽어 기존 행 전수 대조(값 불변)
        with open(p, encoding="utf-8-sig", newline="") as f:
            back = list(csv.DictReader(f))
        assert len(back) == len(old) + len(add), table
        for a, b in zip(old, back[: len(old)]):
            for c in fields:
                assert a[c] == b[c], f"{table} 기존 값 바뀜 {a[key]}.{c}"
            for c in cols:
                if c not in fields:
                    assert b[c] == "", f"{table} 새 칸이 기존 행에 값: {a[key]}.{c}"
        report[table] = {"from": src, "old": len(old), "new": len(add), "total": len(back), "new_cols": [c for c in cols if c not in fields]}
    json.dump(report, open(os.path.join(HERE, "build_report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for t, v in report.items():
        print(f"{t:20s} {v['from']:20s} 기존 {v['old']:4d} + 새 {v['new']:3d} = {v['total']:4d}  새 칸 {v['new_cols']}")
    st = Counter(j["status"] for j in new["usf_judge"])
    print("판정", dict(st), "· 조치요구 알림", sum(1 for n in new["notification"] if n["note"] == "이행점검"))
    if "--publish" in sys.argv:
        dst = os.path.join(VER, "seed")
        if os.path.exists(dst):
            raise SystemExit("seed 폴더가 이미 있다 — 덮어쓰지 않는다(지우고 다시 하려면 사람이 확인)")
        shutil.move(OUT, dst)
        print("→", dst)


if __name__ == "__main__":
    main()
