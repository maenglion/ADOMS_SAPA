# -*- coding: utf-8 -*-
"""
재해 발생 직후 대응(/recurrence)용 예시 자료 — ops_v0.8 (2026-09-22)

뼈대: 중대재해처벌법 시행령 제10조제7호다목 (시민) · 제4조제8호 (산업).
  원문 대조(정본 unit_20260901_v2.1_before_20260920u.csv, DOC-000005):
    a10/n7/mda "중대시민재해가 발생한 경우 사상자 등에 대한 긴급구호조치, 공중이용시설 또는 공중교통수단에 대한
                긴급안전점검, 위험표지 설치 등 추가 피해방지 조치, 관계 행정기관 등에 대한 신고와 원인조사에 따른
                개선조치에 관한 사항"
    a4/n8 가·나·다 "작업 중지, 근로자 대피, 위험요인 제거 등 대응조치" · "중대산업재해를 입은 사람에 대한 구호조치"
                · "추가 피해방지를 위한 조치"
  산업 쪽 관계 기관 보고(DOC-000057 a54/p2 · DOC-000059 a73/p1):
    산업안전보건법 제54조제2항 — 중대재해 발생 사실을 알게 된 경우 지체 없이 고용노동부장관에게 보고
    같은 법 시행규칙 제73조제1항 — 사망·3일 이상 휴업 부상은 발생한 날부터 1개월 이내 산업재해조사표 제출
  실무 절차(법령 아님): 서울시 시민재해 안전보건업무 안내서 표 5-8 · 붙임 5-9(최초·직후·수시 보고, 시간 기한 없음)
    · 붙임 5-10(개요·피해·긴급구조·수습·지원·협조·향후 대책) · 붙임 5-16(언론 창구).

만드는 표 — 이 두 개만(같은 판 폴더에 다른 채팅 파일이 있을 수 있다)
  · incident_response.csv — 긴급 조치·경영책임자 지시 1건 = 1행
  · incident_report.csv   — 보고 1건 = 1행(최초·직후·수시), 경영책임자 「최초보고 받음」은 ceo_ack_* 칸
  기관 설정(incident_response_setting)은 예시 자료를 두지 않는다 — 없으면 화면이 기본 60분을 쓴다.

예시 세 가지(기존 재해 ops_v0.6 incident.csv 에 붙인다)
  · INC-005 터널 조명 낙하(시민) — 대응 끝남 · 최초보고 35분 · 수시보고 2회
  · INC-002 교량 난간 파손(시민) — 조치는 끝났으나 최초보고 3시간 10분(기한 넘김) · 경영책임자 받음은 총괄 대리 기록
  · INC-009 선별장 허리 부상(산업) — 진행 중 · 산업재해조사표·표시 미완 · 최초보고 받음 기록 없음

사용: python _build/build_incident_response_v08.py
  같은 이름의 CSV 가 있으면 멈춘다(판 덮어쓰기 금지).
"""
import csv, glob, io, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "ops_v0.8_20260922", "seed")
EX = "예시 자료"

RESP_COLS = ["resp_id", "incident_id", "kind", "status", "done_at", "done_by", "target_org", "detail",
             "evidence_name", "evidence_url", "proxy", "recorded_by", "recorded_at", "note"]
REP_COLS = ["report_id", "incident_id", "report_stage", "seq", "reported_at", "reporter_staff_id", "recipients",
            "agency_name", "channel", "overview", "damage", "rescue", "recovery", "support", "next_plan",
            "evidence_name", "evidence_url", "ceo_ack_at", "ceo_ack_by", "ceo_ack_proxy", "ceo_ack_recorded_by",
            "recorded_by", "recorded_at", "note"]
KINDS = {"recognize", "call", "rescue", "inspect", "sign", "restrict", "notify", "agency", "press", "family",
         "ceo_prevent", "ceo_cause"}


def latest(table):
    fs = sorted(glob.glob(os.path.join(BASE, "ops_*", "seed", table + ".csv")))
    fs = [f for f in fs if os.sep + "ops_v0.8_" not in f]
    with io.open(fs[-1], encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def wr(name, rows, cols):
    p = os.path.join(OUT, name + ".csv")
    if os.path.exists(p):
        sys.exit("멈춤: %s 가 이미 있다(판 덮어쓰기 금지)" % p)
    os.makedirs(OUT, exist_ok=True)
    with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            assert set(r) <= set(cols), (name, set(r) - set(cols))
            w.writerow({c: r.get(c, "") for c in cols})
    print("  %-26s %4d행" % (name + ".csv", len(rows)))


# ── 대응 기록 ─────────────────────────────────────────────────────
_n = [0]


def A(inc, kind, at, by, detail, status="완료", org="", ev="", proxy="", rec=None):
    _n[0] += 1
    return {"resp_id": "IRS-%03d" % _n[0], "incident_id": inc, "kind": kind, "status": status, "done_at": at,
            "done_by": by, "target_org": org, "detail": detail, "evidence_name": ev, "evidence_url": "",
            "proxy": proxy, "recorded_by": rec or by, "recorded_at": at, "note": EX}


_m = [0]


def R(inc, stage, at, by, recips, overview, seq="", agency="", channel="전화", damage="", rescue="", recovery="",
      support="", nxt="", ev="", ack="", ack_proxy="", ack_rec=""):
    _m[0] += 1
    return {"report_id": "IRP-%03d" % _m[0], "incident_id": inc, "report_stage": stage, "seq": seq,
            "reported_at": at, "reporter_staff_id": by, "recipients": recips, "agency_name": agency,
            "channel": channel, "overview": overview, "damage": damage, "rescue": rescue, "recovery": recovery,
            "support": support, "next_plan": nxt, "evidence_name": ev, "evidence_url": "",
            "ceo_ack_at": ack, "ceo_ack_by": "CEO-1" if ack else "", "ceo_ack_proxy": ack_proxy,
            "ceo_ack_recorded_by": (ack_rec or ("CEO-1" if ack else "")), "recorded_by": by, "recorded_at": at,
            "note": EX}


resp = [
    # INC-005 터널 조명 낙하(시민) — 대응 끝남
    A("INC-005", "recognize", "2026-07-22 21:40", "SD03-2", "도로 순찰 무전 — 터널 상행 조명등 1기 낙하, 주행 차량 앞유리 파손"),
    A("INC-005", "call", "2026-07-22 21:43", "SD03-2", "인명 피해 없음 확인 · 112에 상행 2차로 교통 통제 요청", org="112"),
    A("INC-005", "rescue", "2026-07-22 21:50", "SD03-2", "운전자 부상 없음 확인(현장 대화) — 구호 대상자 없음", status="해당 없음"),
    A("INC-005", "sign", "2026-07-22 21:55", "SD03-2", "상행 2차로 위험표지·라바콘 설치", org="터널 상행 입구부", ev="위험표지_설치사진_0722.jpg"),
    A("INC-005", "restrict", "2026-07-22 21:55", "SD03-2", "상행 2차로 차단 — 07-23 05:00 임시 결속 뒤 해제"),
    A("INC-005", "agency", "2026-07-22 22:30", "SD03-1", "시민 피해 사고(차량 파손) 발생 통보", org="경기도 재난안전상황실"),
    A("INC-005", "inspect", "2026-07-23 02:00", "SD03-1", "상행 전 구간 조명 고정부 긴급 점검 — 볼트 부식 9기 추가 발견, 임시 결속",
      ev="긴급안전점검_결과_청명터널_0723.pdf"),
    A("INC-005", "notify", "2026-07-23 07:00", "SD03-1", "시 누리집·교통정보 문자 — 상행 차로 부분 통제 안내", org="시 누리집"),
    A("INC-005", "press", "2026-07-23 08:00", "SD03-1", "언론 창구를 도로과장 한 사람으로 지정"),
    A("INC-005", "ceo_prevent", "2026-07-22 22:40", "CEO-1", "같은 형식 조명 전 구간 긴급 점검 · 결과 내일 오전 보고", status="지시", org="SD03-1"),
    A("INC-005", "ceo_cause", "2026-07-23 10:00", "CEO-1", "원인 조사 착수 — 정기점검표에 조명 고정부 항목이 있는지 포함, 1주 안에 보고", status="지시", org="SD03-1"),

    # INC-002 교량 난간 파손(시민) — 조치는 끝남, 최초보고 늦음
    A("INC-002", "recognize", "2026-05-23 14:20", "SD02-2", "시민 신고(120) — 교량 보도 난간 파손, 보행자가 넘어져 무릎 부상"),
    A("INC-002", "call", "2026-05-23 14:25", "SD02-2", "119 구급 요청 — 부상자 병원 이송", org="119"),
    A("INC-002", "rescue", "2026-05-23 14:30", "SD02-2", "현장 응급처치 · 보호자 연락 · 병원 이송 동행"),
    A("INC-002", "sign", "2026-05-23 14:40", "SD02-2", "파손 구간 위험표지·안전띠 설치", org="교량 보도 북측", ev="난간파손_위험표지_0523.jpg"),
    A("INC-002", "restrict", "2026-05-23 14:40", "SD02-2", "파손 구간 보행 통제 · 반대편 보도 우회 안내"),
    A("INC-002", "inspect", "2026-05-23 17:00", "SD02-1", "교량 난간 전 구간 긴급 점검 — 추가 파손 2곳", ev="교량난간_긴급점검표_0523.pdf"),
    A("INC-002", "agency", "2026-05-23 18:00", "SD02-1", "시민 부상 사고 발생 통보", org="경기도 재난안전상황실"),
    A("INC-002", "notify", "2026-05-24 09:00", "SD02-1", "인근 주민센터·아파트 관리사무소 게시 요청", org="주민센터"),
    A("INC-002", "press", "2026-05-24 09:00", "SD02-1", "언론 문의 없음 — 문의가 오면 안전총괄과장이 창구", status="해당 없음"),
    A("INC-002", "ceo_prevent", "2026-05-23 18:10", "CEO-1", "관내 같은 형식 보도 난간 일제 점검", status="지시", org="SD02-1",
      proxy="Y", rec="SD01-1"),
    A("INC-002", "ceo_cause", "2026-05-24 09:30", "CEO-1", "원인 조사 — 정기점검 주기 초과 여부 포함", status="지시", org="SD02-1"),

    # INC-009 선별장 허리 부상(산업) — 진행 중
    A("INC-009", "recognize", "2026-09-03 10:05", "SD12-2", "작업반장 전화 — 폐기물 포대 운반 중 허리 통증 호소"),
    A("INC-009", "call", "2026-09-03 10:10", "SD12-2", "재해자 거동 가능 — 동료 차량으로 병원 이동, 119 부르지 않음", status="해당 없음"),
    A("INC-009", "restrict", "2026-09-03 10:10", "SD12-2", "포대 운반 작업 중지 — 2인 1조 기준이 설 때까지"),
    A("INC-009", "rescue", "2026-09-03 10:15", "SD12-2", "병원 이송 동행 — 요추 염좌 진단(치료 3주)"),
    A("INC-009", "inspect", "2026-09-03 15:00", "SD12-1", "운반 동선·포대 무게 점검 — 25kg 넘는 포대 14개", ev="선별장_운반동선_점검표_0903.pdf"),
    A("INC-009", "press", "2026-09-03 15:00", "SD12-1", "언론 문의 없음", status="해당 없음"),
]

reps = [
    R("INC-005", "최초보고", "2026-07-22 22:15", "SD03-1", "경영책임자 · 총괄",
      "07-22 21:35경 청명터널 상행 조명등 1기 낙하, 주행 차량 앞유리 파손 · 추정 원인 고정 볼트 부식 · 담당 도로과",
      damage="인명 피해 없음 · 차량 1대 파손", rescue="구호 대상 없음", recovery="상행 2차로 차단·위험표지",
      ack="2026-07-22 22:20"),
    R("INC-005", "직후보고", "2026-07-22 23:30", "SD03-1", "경영책임자 · 총괄 · 관계 행정기관",
      "현장 확인 — 낙하 조명 1기 수거, 같은 열 조명 고정부 육안 점검 중", agency="경기도 재난안전상황실", channel="서면",
      damage="차량 1대(앞유리)", recovery="도로과 4명·고소작업차 1대 투입", support="112 교통 통제 협조",
      nxt="상행 전 구간 조명 고정부 긴급 점검(야간)", ev="상황보고_2보_청명터널.hwp"),
    R("INC-005", "수시보고", "2026-07-23 09:00", "SD03-1", "경영책임자 · 총괄",
      "긴급 점검 결과 — 볼트 부식 9기 추가, 임시 결속 완료", seq="1", channel="서면",
      recovery="05:00 차로 통제 해제", nxt="부식 볼트 전량 교체 발주 · 원인 조사", ev="상황보고_3보_청명터널.hwp"),
    R("INC-005", "수시보고", "2026-07-23 15:00", "SD03-1", "경영책임자 · 총괄",
      "언론 문의 1건 — 창구(도로과장) 응대 · 차량 피해 보상 절차 안내", seq="2", channel="문자",
      nxt="원인 조사 07-29까지"),

    R("INC-002", "최초보고", "2026-05-23 17:30", "SD02-1", "경영책임자 · 총괄",
      "05-23 14:10경 교량 보도 난간 파손으로 보행자 넘어짐 · 추정 원인 난간 하부 부식 · 담당 안전총괄과",
      damage="부상 1명(무릎 찰과상)", rescue="119 이송", recovery="파손 구간 통제·위험표지",
      ack="2026-05-23 17:45", ack_proxy="Y", ack_rec="SD01-1"),
    R("INC-002", "직후보고", "2026-05-23 19:00", "SD02-1", "경영책임자 · 총괄 · 관계 행정기관",
      "긴급 점검 결과 추가 파손 2곳 — 모두 통제", agency="경기도 재난안전상황실", channel="서면",
      damage="부상 1명 · 난간 3곳 파손", recovery="안전총괄과 3명 · 임시 안전띠", nxt="난간 보수 발주 · 원인 조사",
      ev="상황보고_2보_교량난간.hwp"),
    R("INC-002", "수시보고", "2026-05-24 10:00", "SD02-1", "경영책임자 · 총괄",
      "부상자 귀가(통원 치료) · 임시 보수 착수", seq="1", channel="문자"),

    R("INC-009", "최초보고", "2026-09-03 10:50", "SD12-1", "경영책임자 · 총괄",
      "09-03 09:50경 재활용 선별장 포대 운반 중 작업자 허리 부상 · 추정 원인 중량물 반복 운반 · 담당 부서",
      damage="부상 1명(요추 염좌 추정)", rescue="병원 이송", recovery="포대 운반 작업 중지"),
    R("INC-009", "직후보고", "2026-09-03 14:00", "SD12-1", "경영책임자 · 총괄",
      "진단 결과 요추 염좌 치료 3주 — 3일 이상 휴업이라 산업재해조사표 제출 대상", channel="서면",
      damage="부상 1명(치료 3주)", nxt="산업재해조사표 10-03까지 제출 · 운반 보조기구 검토"),
]


def main():
    staff = {r["staff_id"] for r in latest("staff")} | {"CEO-1"}
    incs = {r["incident_id"]: r for r in latest("incident")}
    for r in resp:
        assert r["incident_id"] in incs and incs[r["incident_id"]]["event_class"] != "아차사고", r
        assert r["kind"] in KINDS, r
        assert r["done_by"] in staff and r["recorded_by"] in staff, r
        assert r["done_at"][:10] >= incs[r["incident_id"]]["occurred_at"], r
        if r["kind"].startswith("ceo_"):
            assert r["target_org"] in staff, r
    for r in reps:
        assert r["incident_id"] in incs, r
        assert r["reporter_staff_id"] in staff, r
        assert r["reported_at"][:10] >= incs[r["incident_id"]]["occurred_at"], r
        if r["ceo_ack_at"]:
            assert r["ceo_ack_at"] >= r["reported_at"] and r["ceo_ack_recorded_by"] in staff, r
    # 사고마다 최초보고 하나, 인지 기록 하나
    for i in {r["incident_id"] for r in reps}:
        assert sum(1 for r in reps if r["incident_id"] == i and r["report_stage"] == "최초보고") == 1, i
        assert sum(1 for r in resp if r["incident_id"] == i and r["kind"] == "recognize") == 1, i
    wr("incident_response", resp, RESP_COLS)
    wr("incident_report", reps, REP_COLS)
    print("완료 →", OUT)


if __name__ == "__main__":
    main()
