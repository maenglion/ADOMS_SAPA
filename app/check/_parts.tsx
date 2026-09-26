/**
 * [400 · 교육자료 버전] 묶음 F — 이행점검 화면 공용 조각(좌측 LNB · 제목 · 모달 틀).
 * 좌측은 참고 명세 SCR-088~090 대로 1단(이행점검 › 트랙 3개)만 둔다(의무 단계 아코디언 없음).
 */
import Link from "next/link";
import MenuSide from "@/components/us/MenuSide";
import type { TrackKey } from "@/lib/us/tracks";
import { LNB, NAME } from "./_lib";

// 09-25 사용자: 좌측 = 머리 메뉴 「이행점검 및 조치」(이행점검 3 · 개선 및 조치 2) · 접는 묶음
export function CheckSide({ track, role, page = "" }: { track: TrackKey; role: string; page?: string }) {
  void track; void role; void page;
  return <MenuSide group="이행점검및 조치" />;
}

export function CheckHead({ track, sub, right }: { track: TrackKey; sub: string; right?: React.ReactNode }) {
  return (
    <div className="usf-top">
      <div>
        <h1 className="us-h1"><span className="usb2-pre">이행점검</span> {NAME[track]}</h1>
        <div className="usf-sub">{sub}</div>
      </div>
      {right && <div className="usf-top-r">{right}</div>}
    </div>
  );
}

// 09-26 사용자: 메뉴 밖 화면 합치기 — 과제 단위 반기 점검(점검 회차 계획·회차 결재 /inspections · 점검 판정 /review)은
//   이행점검 각 대상 화면에서 들어간다. 옛 화면은 자료(점검 회차·판정 표)를 그대로 쓰고, 틀만 이행점검 레이아웃·좌측 안으로 옮겼다.
//   tk = 돌아올 대상(ws·fc·mt). 옛 화면의 「← 이행점검으로」가 이 값을 읽는다.
// 09-26 사용자: 옛 점검 화면 합치기 — 합친 뒤에는 이 줄을 그리지 않는다(lib/check_merge.ts OLD_CHECK_MERGED = false 면 다시 보인다).
export function CheckOldLinks({ track, role }: { track: TrackKey; role: string }) {
  const tq = `role=${role}&tk=${track}`;
  return (
    <div className="c26-old">
      <span className="c26-old-h">과제 단위 반기 점검</span>
      <Link className="us-btn-s" href={`/inspections?${tq}`}>점검 회차 계획</Link>
      <Link className="us-btn-s" href={`/review?${tq}`}>점검 판정</Link>
      <Link className="us-btn-s" href={`/inspections?${tq}&view=approve`}>회차 결재</Link>
    </div>
  );
}

/** 09-26 사용자: 메뉴 밖 화면 합치기 — 옛 화면 제목 줄(제목 + 「← 이행점검으로」). tk 가 없거나 틀리면 사업장으로. */
export function OldTitle({ title, role, tk }: { title: string; role: string; tk?: string }) {
  const t = tk === "fc" || tk === "mt" ? tk : "ws";
  return (
    <div className="c26-title">
      <h1 className="v2h">{title}</h1>
      <Link className="c26-back" href={`/check/${t}?role=${role}`}>← 이행점검으로</Link>
    </div>
  );
}

/** 주소 쿼리로 여닫는 모달(클라이언트 JS 없음). close = 닫기 주소. */
export function Modal({ title, close, children }: { title: string; close: string; children: React.ReactNode }) {
  return (
    <div className="us-modal-bg">
      <div className="us-modal usf-modal">
        <div className="us-modal-h"><span>{title}</span><Link href={close} className="usf-x" aria-label="닫기">✕</Link></div>
        <div className="us-modal-b">{children}</div>
      </div>
    </div>
  );
}
