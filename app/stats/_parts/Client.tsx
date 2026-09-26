"use client";
/**
 * [400 · 교육자료 버전] 묶음 G 작은 클라이언트 부품.
 *  · AutoForm  — 셀렉트·날짜를 바꾸면 곧바로 다시 조회(명세 SCR-091·095: 조회 단추 없음)
 *  · ConfirmButton — 시스템 공통 확인 팝업(SCR-100·101): 큰 파란 「?」 + 「안전보건체계 통합관리시스템」 + 메시지 + 확인/취소
 *      확인 = 이 단추가 속한 폼을 제출 · 취소 = 팝업만 닫힘(수정 모드 유지)
 *  · FileSlots — 첨부파일 5칸(SCR-099) · 개당 10MB 선검증
 */
import { useRef, useState } from "react";

export function AutoForm({ children, className, action = "" }: { children: React.ReactNode; className?: string; action?: string }) {
  return (
    <form className={className} action={action} method="get"
      onChange={(e) => {
        const t = e.target as HTMLElement;
        const ty = (t as HTMLInputElement).type;
        if (t.tagName === "SELECT" || ty === "date" || ty === "radio") (e.currentTarget as HTMLFormElement).requestSubmit();   // 09-25 라디오도
      }}>
      {children}
    </form>
  );
}

export function ConfirmButton({ label, message, className, formId, name, value }: {
  label: string; message: string; className?: string; formId?: string; name?: string; value?: string;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {/* 실제 제출 단추(숨김) — name/value 로 어떤 동작인지 서버 액션에 알린다 */}
      <button ref={btn} type="submit" form={formId} name={name} value={value} hidden />
      {open && (
        <div className="usg-cf-bg" role="dialog" aria-modal="true">
          <div className="usg-cf">
            <div className="usg-cf-q">?</div>
            <div className="usg-cf-t">안전보건체계 통합관리시스템</div>
            <div className="usg-cf-m">{message}</div>
            <div className="usg-cf-b">
              <button type="button" className="ok" onClick={() => { setOpen(false); btn.current?.click(); }}>확인</button>
              <button type="button" className="no" onClick={() => setOpen(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const MAX = 10 * 1024 * 1024;

/** 첨부파일 5칸 — 앞 칸을 채우면 다음 칸이 활성(명세: 첫 2행 활성·나머지 흐림 — 순차 활성화로 추정). */
export function FileSlots({ n = 5 }: { n?: number }) {
  const [names, setNames] = useState<string[]>(Array(n).fill(""));
  const [err, setErr] = useState("");
  const active = Math.min(n, names.filter(Boolean).length + 2); // TODO: 확인 — 순차 활성화(판독불확실)
  return (
    <div className="usg-slots">
      {names.map((nm, i) => (
        <div key={i} className={`usg-slot${i < active ? "" : " dim"}`}>
          <span className="usg-clip">📎</span>
          <span className={`usg-slot-name${nm ? "" : " empty"}`}>{nm || "선택된 파일 없음"}</span>
          <label className="us-btn-s">파일찾기
            <input type="file" name={`file${i + 1}`} hidden disabled={i >= active}
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f && f.size > MAX) { setErr(`「${f.name}」은 10MB 를 넘습니다.`); e.currentTarget.value = ""; return; }
                setErr("");
                const next = [...names]; next[i] = f ? f.name : ""; setNames(next);
              }} />
          </label>
        </div>
      ))}
      <div className="usg-slot-note">※개당 10MB 이하</div>
      {err && <div className="usg-err">{err}</div>}
    </div>
  );
}
