/**
 * [400 · 교육자료 버전] 묶음 D — 공통 조각(서버 컴포넌트).
 *  Ctx(화면 문맥) · BlockForm(표 한 개 = 폼 한 개) · Ev(증빙 칸) · Viewer(이미지·PDF 뷰어) · Modal · BudgetGuide · Btn
 */
import Link from "next/link";
import { saveBlock } from "../actions";
import { FileBox } from "./client";
import { BASE, blockRows, type Rec, type Target, type Ev as EvT } from "../_lib/model";

export type Ctx = {
  role: string; step: string; t: Target; dept: string; deptName: string;
  recs: Rec[]; sp: Record<string, string>; nonce: string;
  /** 대상 목록(셀렉터) · 같은 부서 담당 대상 수(담당 대상 일괄적용) */
  list: Target[]; all: Target[]; peers: number;
  /** 지금 화면 주소(바꿀 값만 넘긴다 — 빈 값은 뺀다) */
  href: (o?: Record<string, string | undefined>) => string;
  /** 저장 뒤 돌아올 주소(팝업·알림 뺌) */
  back: string;
};

/** 주소 만들기 — sp 에서 이어받을 값만 이어받는다. */
const KEEP = ["role", "t", "t2", "pa", "pb", "mk", "all", "lk", "ln", "lq"];
export function makeHref(step: string, sp: Record<string, string>) {
  return (o: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    for (const k of KEEP) if (sp[k]) p.set(k, sp[k]);
    for (const [k, v] of Object.entries(o)) { if (v === undefined || v === "") p.delete(k); else p.set(k, v); }
    const s = p.toString();
    return `${BASE}/${step}${s ? `?${s}` : ""}`;
  };
}

/** 표 한 개 = 폼 한 개. 표 안의 모든 버튼이 이 폼을 제출한다(actions.saveBlock). */
export function BlockForm({ ctx, block, scope, dept, hasNa, bulkLabel, children, className }: {
  ctx: Ctx; block: string; scope?: string; dept?: string; hasNa?: boolean; bulkLabel?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <form action={saveBlock} id={block} key={`${block}-${ctx.nonce}`} className={`usd-form ${className || ""}`}>
      {/* 입력칸에서 Enter 를 누르면 「저장」이 눌리게 — 첫 제출 단추 */}
      <button type="submit" name="intent" value="save" className="usd-default" tabIndex={-1} aria-hidden>저장</button>
      <input type="hidden" name="role" value={ctx.role} />
      <input type="hidden" name="scope" value={scope || ctx.t.id} />
      <input type="hidden" name="dept" value={dept || ctx.dept} />
      <input type="hidden" name="step" value={ctx.step} />
      <input type="hidden" name="block" value={block} />
      <input type="hidden" name="back" value={ctx.back} />
      {hasNa && <input type="hidden" name="hasNa" value="Y" />}
      {bulkLabel && <input type="hidden" name="bulkLabel" value={bulkLabel} />}
      {children}
    </form>
  );
}

/** 줄 표시(숨은 칸) — 저장할 때 이 줄을 읽는다. presets = 새 줄 기본값(p.) · checks = 체크칸 이름. */
export function RowId({ rid, presets, checks }: { rid: string; presets?: Record<string, string>; checks?: string[] }) {
  return (
    <>
      <input type="hidden" name="rid" value={rid} />
      {Object.entries(presets || {}).map(([k, v]) => <input key={k} type="hidden" name={`p.${rid}.${k}`} value={v} />)}
      {(checks || []).map((k) => <input key={k} type="hidden" name={`ck.${rid}`} value={k} />)}
    </>
  );
}

/** 칸 입력 — 이름 규칙 c.<rid>.<칸>. */
export function In({ rid, k, v, type = "text", ph, w }: { rid: string; k: string; v?: string; type?: string; ph?: string; w?: string }) {
  return <input type={type} name={`c.${rid}.${k}`} defaultValue={v || ""} placeholder={ph} style={w ? { width: w } : undefined}
    inputMode={type === "number" ? "numeric" : undefined} aria-label={ph || k} />;
}

/** 증빙자료 칸 — rid 줄의 files[evkey]. 파일 이름을 누르면 아래 뷰어에 보인다. */
export function Ev({ ctx, rid, evkey = "ev", files, showPick, accept, pickLabel, plus, extra }: {
  ctx: Ctx; rid: string; evkey?: string; files?: EvT[]; showPick?: boolean; accept?: string; pickLabel?: string; plus?: boolean; extra?: React.ReactNode;
}) {
  const list = (files || []).map((f) => ({
    name: f.name, url: f.url,
    view: f.url ? `${ctx.href({ vu: f.url, vn: f.name })}#viewer` : `${ctx.href({ vn: f.name, vu: "" })}#viewer`,
  }));
  const real = !rid.includes(":");
  return <FileBox name={`f.${rid}.${evkey}`} files={list} clearIntent={real ? `clrf:${rid}:${evkey}` : undefined} showPick={showPick} accept={accept} pickLabel={pickLabel} plus={plus} extra={extra} />;
}

/** 행 삭제 🗑 */
export function Del({ rid }: { rid: string }) {
  return <button className="usd-ico-btn" name="intent" value={`del:${rid}`} title="행 삭제">🗑</button>;
}
export function Btn({ intent, children, kind = "", title }: { intent: string; children: React.ReactNode; kind?: string; title?: string }) {
  return <button className={`us-btn ${kind}`} name="intent" value={intent} title={title}>{children}</button>;
}
export function AddBtn({ intent = "add", children }: { intent?: string; children: React.ReactNode }) {
  return <button className="usd-addbtn" name="intent" value={intent}>{children}</button>;
}

/** 이미지 뷰어 — 그림은 그대로, PDF 는 문서 틀, 그 밖은 내려받기. 파일이 없으면 fallback(조직도 등)을 보인다. */
export function Viewer({ title = "이미지 뷰어", url, name, fallback }: { title?: string; url?: string; name?: string; fallback?: React.ReactNode }) {
  const img = url && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url + (name || ""));
  const pdf = url && /\.pdf$/i.test(name || url);
  return (
    <div className="us-viewer" id="viewer">
      <div className="us-viewer-h">{title}{name ? <span className="usd-viewer-name"> — {name}</span> : null}</div>
      <div className="us-viewer-b">
        {img ? <img src={url} alt={name || "증빙"} />
          : pdf ? <iframe className="usd-pdf" src={url} title={name || "PDF"} />
          : url ? <a href={url} target="_blank">{name || "첨부 파일 열기"} ⤓</a>
          : fallback || (name ? <span className="usd-viewer-none">「{name}」 — 미리보기할 원본 파일이 없습니다(파일 이름만 등록됨). 파일을 다시 올리면 여기에서 볼 수 있습니다.</span> : <span className="us-ph">🖼</span>)}
      </div>
    </div>
  );
}

/** 뷰어에 무엇을 띄울지 — 주소(vu/vn)가 우선, 없으면 화면 기록의 첫 그림·PDF. */
export function viewerPick(ctx: Ctx, recs: Rec[]) {
  if (ctx.sp.vn || ctx.sp.vu) return { url: ctx.sp.vu || "", name: ctx.sp.vn || "" };
  for (const r of recs) for (const list of Object.values(r.files || {})) for (const f of list || [])
    if (f.url && /\.(png|jpe?g|gif|webp|pdf)$/i.test(f.name)) return { url: f.url, name: f.name };
  return { url: "", name: "" };
}

/** 팝업 틀 — 주소 쿼리로 여닫는다(?modal=…). 닫기 = 쿼리 뺀 주소. */
export function Modal({ ctx, title, crumb = true, wide, children }: { ctx: Ctx; title: string; crumb?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="us-modal-bg usd-modal-bg">
      <div className={`us-modal usd-modal${wide ? " wide" : ""}`} role="dialog" aria-label={title}>
        <div className="us-modal-h"><span>{title}</span><Link href={`${ctx.back}#top`} className="usd-x" aria-label="닫기">✕</Link></div>
        <div className="us-modal-b">
          {crumb && <div className="usd-crumb">계획·이행·점검 <span>법 의무이행 조치</span> <span>의무이행(공중이용시설·공중교통수단)</span></div>}
          {children}
        </div>
      </div>
    </div>
  );
}

/** 명세 SCR-059·068 하단 예산 항목 안내표(읽기 전용 — 원문 그대로). */
export function BudgetGuide() {
  const cols: [string, string[]][] = [
    ["안전점검비", ["시설물안전법 안전점검 등 비용", "관계 법령에 따른 안전점검 등 비용", "안전점검 등에 따른 조치·개선 비용", "안전점검 업무 수행인력 인건비"]],
    ["보수·보강비", ["시설물 보수·보강 등의 비용", "안전 관련 물품 및 보호구 등 구입비", "안전 관련 장비 등 구입 및 유지·보수 비용", "보수·보강 업무 수행인력 인건비"]],
    ["안전조치비", ["중대시민재해 예방을 위한 유해·위험요인 확인 및 점검 비용", "유해·위험요인 조치 및 개선 비용", "중대시민재해 발생시 대응 비용"]],
    ["교육·훈련비", ["안전 교육 및 훈련비", "안전 관련 행사추진 비용 (홍보비)"]],
    ["기타", ["안전관리 운영체계 관련 문서 등 개발 비용", "그 외 안전확보에 소요되는 비용"]],
  ];
  return (
    <table className="us-tbl usd-guide">
      <thead><tr>{cols.map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody><tr>{cols.map(([h, li]) => <td key={h}><ul>{li.map((x) => <li key={x}>{x}</li>)}</ul></td>)}</tr></tbody>
    </table>
  );
}

/** 저장 알림 한 줄. */
export function Msg({ ctx }: { ctx: Ctx }) {
  return ctx.sp.msg ? <div className="usd-msg" role="status">{ctx.sp.msg}</div> : null;
}

/** 해당없음 체크 줄 — 켜면 아래 입력 영역이 사라진다(CSS :has, 명세 SCR-067·069). */
export function NaLine({ checked, label }: { checked: boolean; label: string }) {
  return (
    <label className="usd-na-line">
      <input type="checkbox" name="na" value="Y" defaultChecked={checked} className="usd-na-cb" />
      <span className="usd-na-mark" aria-hidden>✓</span> {label}
    </label>
  );
}

/** 화면 줄 — 저장된 줄은 rec_id, 일괄적용 분은 C:<rec_id>, 비어 있으면 새 줄 N:1(명세 화면처럼 빈 줄 하나). */
export type VRow = { rid: string; data: Record<string, any>; files: Record<string, EvT[]>; saved: boolean };
export function vrows(ctx: Ctx, block: string, o: { scope?: string; dept?: string; blank?: boolean; step?: string } = {}) {
  const { rows, fallback } = blockRows(ctx.recs, o.step || ctx.step, block, o.scope || ctx.t.id, o.dept || ctx.dept);
  const out: VRow[] = rows.map((r) => ({ rid: fallback ? `C:${r.rec_id}` : r.rec_id, data: r.data, files: r.files, saved: !fallback }));
  if (!out.length && o.blank !== false) out.push({ rid: "N:1", data: {}, files: {}, saved: false });
  return { rows: out, fallback };
}
export function FallbackNote({ on }: { on: boolean }) {
  return on ? <p className="usd-note">담당 대상 일괄적용으로 들어온 내용입니다. 이 대상에서 저장하면 이 대상의 기록이 됩니다.</p> : null;
}
