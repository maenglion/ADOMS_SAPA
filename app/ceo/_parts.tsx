/**
 * [400 · 교육자료 버전] 묶음 F — 기관장 예방활동 공용 조각(좌측 메뉴 · 모달 틀 · 시각 표기).
 * 참고 명세에는 이 메뉴의 화면이 없다(명세 00 §11 #10) — 서한문은 교육자료 톤으로 새로 설계, 활동기록은 SCR-026 을 따른다.
 */
import Link from "next/link";
import { ymd } from "@/lib/day";

// 09-26 사용자: 메뉴 밖 화면 합치기 — 「경영책임자 보고 요약」(/exec)을 맨 앞에. 머리 메뉴 순서(보고 요약 · 서한문 · 활동사항)와 같다.
export function CeoSide({ on, role }: { on: "exec" | "letter" | "log"; role: string }) {
  return (
    <aside className="us-side">
      <div className="us-panel">
        <div className="us-panel-h">기관장 예방활동</div>
        <Link href={`/exec?role=${role}`} className={on === "exec" ? "on" : ""}>{on === "exec" ? "◉ " : ""}경영책임자 보고 요약</Link>
        <Link href={`/ceo/letter?role=${role}`} className={on === "letter" ? "on" : ""}>{on === "letter" ? "◉ " : ""}기관장 서한문</Link>
        <Link href={`/ceo?role=${role}`} className={on === "log" ? "on" : ""}>{on === "log" ? "◉ " : ""}기관장 활동사항</Link>
      </div>
    </aside>
  );
}

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

/** 저장된 시각(ISO) → 「YYYY-MM-DD HH:MM」(한국 시각). 날짜만 있으면 그대로. */
export function fmtAt(v: any): string {
  const s = String(v || "");
  if (!s || /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(+d)) return s.slice(0, 16).replace("T", " ");
  const p = (n: number) => String(n).padStart(2, "0");
  return `${ymd(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const newId = (p: string) =>
  `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

/** 서한문 수신 대상 · 활동 유형 코드(화면 문자열 그대로). */
export const RECIPIENTS = ["전 직원", "실·국·사업소장", "현업 부서 담당자", "도급·용역·위탁 수급인"];
export const ACT_TYPES = ["회의주재", "현장점검", "지시", "교육", "보고받음", "기타"];
