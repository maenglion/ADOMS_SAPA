/**
 * [400 · 교육자료 버전] 묶음 C — 표 칸 부품(서버). 명세 G-6 인라인 입력 표의 칸 모양.
 * 입력 이름 약속은 ../actions.ts 머리 주석 참고(f~rid~key · file~rid · id · op).
 */
import Link from "next/link";
import { EvidenceViewer } from "@/components/us/Parts";
import FileCell from "./FileCell";
import type { Rec } from "../_lib/usc";
import type { FileRef } from "../_lib/meta";

/** 화면에 그리는 행 — 있는 행(e) · 새 빈 행(n) · 아직 없는 고정 행(x). */
export type VRow = Rec & { mode: "e" | "n" | "x" };

export function blank(rec_id: string, section: string, data: Record<string, string> = {}, mode: "n" | "x" = "n", parent_id = ""): VRow {
  return {
    rec_id, dept_id: "", year: "", step: "", section, parent_id, ord: 0, locked: false, deleted: false,
    status: "", data, files: [], updated_at: "", updated_by: "", mode,
  };
}
export const live = (r: Rec): VRow => ({ ...r, mode: "e" });

export const fname = (v: VRow, key: string) => `f~${v.rec_id}~${key}`;

/** 행 번호 숨김 칸 — 저장 동작이 이 목록으로 행을 돈다. */
export function Id({ v }: { v: VRow }) {
  return <input type="hidden" name="id" value={`${v.rec_id}~${v.section}~${v.mode}~${v.parent_id}`} />;
}

/** 폼 맥락 숨김 칸 + Enter 키 기본 단추(행 삭제 단추가 먼저 눌리지 않게). */
export function CtxFields({ role, dept, year, step, back }: { role: string; dept: string; year: string; step: string; back: string }) {
  return (
    <>
      <button type="submit" name="op" value="" className="usc-default" tabIndex={-1} aria-hidden="true">저장</button>
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="dept" value={dept} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="step" value={step} />
      <input type="hidden" name="back" value={back} />
    </>
  );
}

export function In({ v, k, type = "text", off, ph, w }: { v: VRow; k: string; type?: "text" | "date" | "number"; off?: boolean; ph?: string; w?: string }) {
  return (
    <input type={type} name={fname(v, k)} defaultValue={v.data[k] || ""} disabled={off} placeholder={ph}
      className={type === "date" ? "usc-date" : undefined} style={w ? { width: w } : undefined} />
  );
}

/** 읽기 전용 값 상자(관리대상 현황에서 넘어온 값 · 고정 구분). */
export const Box = ({ children, grey }: { children: React.ReactNode; grey?: boolean }) => (
  <span className={`usc-box${grey ? " grey" : ""}`}>{children}</span>
);
export const Pill = ({ children }: { children: React.ReactNode }) => <span className="usc-pill">{children}</span>;

/** 행 삭제(휴지통) — 지우지 않고 「지움」 표시만 한다. */
export function Trash({ v, off }: { v: VRow; off?: boolean }) {
  if (v.mode !== "e" || v.locked) return null;
  return <button type="submit" name="op" value={`del:${v.rec_id}`} className="usc-ico" title="행 삭제" disabled={off}>🗑</button>;
}
/** 같은 구분 행 추가(+). */
export function Dup({ v, off }: { v: VRow; off?: boolean }) {
  if (v.mode !== "e") return null;
  return <button type="submit" name="op" value={`dup:${v.rec_id}`} className="usc-plus" title="같은 구분 행 추가" disabled={off}>+</button>;
}

/** 증빙자료 칸 — 올린 파일 목록(이름을 누르면 이미지 뷰어에 보인다 · ⤓ 내려받기 · 🗑 빼기) + 파일선택 · +. */
export function Ev({ v, view, off, locked }: { v: VRow; view: (id: string) => string; off?: boolean; locked?: boolean }) {
  return (
    <div className="usc-ev">
      {v.files.map((f, i) => (
        <div className="usc-ev-f" key={i}>
          <Link className="us-ev-name" href={view(`${v.rec_id}.${i}`)} scroll={false} title="이미지 뷰어에서 보기">{f.name}</Link>
          {f.url ? <a className="us-ico" href={f.url} target="_blank">다운로드</a> : <span className="us-ico dim">-</span>}
          {!off && !locked && <button type="submit" name="op" value={`rmfile:${v.rec_id}:${i}`} className="usc-ico" title="파일 빼기">🗑</button>}
        </div>
      ))}
      {!locked && <FileCell name={`file~${v.rec_id}`} disabled={off} empty={v.files.length ? "선택 파일 없음" : "선택된 파일 없음"} />}
      {locked && !v.files.length && <span className="us-ev-name empty">선택된 파일 없음</span>}
    </div>
  );
}

/** 위탁 표시(체크 + 「위탁」 배지). */
export function Trust({ v, off }: { v: VRow; off?: boolean }) {
  return (
    <label className={`usc-trust${v.data.trust === "Y" ? " on" : ""}`}>
      <input type="hidden" name={fname(v, "trust")} value="" />
      <input type="checkbox" name={fname(v, "trust")} value="Y" defaultChecked={v.data.trust === "Y"} disabled={off} />
      <span>위탁</span>
    </label>
  );
}

/** 이미지 뷰어 — 고른 파일(없으면 이 단계에서 마지막으로 올린 파일). PDF 는 문서 틀로 보인다. */
export function Viewer({ file }: { file?: FileRef | null }) {
  if (!file) return <EvidenceViewer />;
  if (!file.url) {
    return (
      <div className="us-viewer">
        <div className="us-viewer-h">이미지 뷰어</div>
        <div className="us-viewer-b usc-vw-name"><span className="us-ph">🖼</span><span>{file.name}</span></div>
      </div>
    );
  }
  if (/\.pdf($|\?)/i.test(file.url)) {
    return (
      <div className="us-viewer">
        <div className="us-viewer-h">이미지 뷰어 <small className="usc-vw-cap">{file.name}</small></div>
        <div className="us-viewer-b"><iframe src={file.url} title={file.name} className="usc-pdf" /></div>
      </div>
    );
  }
  return <EvidenceViewer url={file.url} name={file.name} />;
}

/** 증빙자료 예시 — 명세 문구를 줄 그대로(번호·기호 포함) 보인다. 제목이 여럿인 칸(필수 내역 · 집행액)도 받는다. */
export function Ex({ blocks }: { blocks: { h: string; lines: React.ReactNode[] }[] }) {
  return (
    <div className="us-example">
      {blocks.map((b, i) => (
        <div key={i} className="usc-ex-b">
          <div className="us-example-h">{b.h}</div>
          {b.lines.map((l, j) => <div key={j} className="usc-ex-l">{l}</div>)}
        </div>
      ))}
    </div>
  );
}
