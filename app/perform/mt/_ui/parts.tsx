// [400 · 교육자료 버전] 묶음 E — 원료·제조물 의무이행 화면들이 같이 쓰는 조각(서버 컴포넌트).
import Link from "next/link";
import { act } from "../actions";
import FilePick from "./FilePick";
import type { Ev, Rec, Site } from "../model";

export type View = {
  role: string; site: Site; step: string; sites: Site[];
  sp: Record<string, string>;
  /** 이 화면 주소(+ 덧붙일 쿼리). */
  href: (extra?: string) => string;
};

/** 폼마다 넣는 숨은 칸 — 누가·어느 사업장·어느 단계. */
export function CtxHidden({ v }: { v: View }) {
  return (
    <>
      <input type="hidden" name="role" value={v.role} />
      <input type="hidden" name="site" value={v.site.site_id} />
      <input type="hidden" name="dept" value={v.site.dept_id} />
      <input type="hidden" name="step" value={v.step} />
    </>
  );
}

/** 한 줄의 숨은 칸 — 행id · 블록 · 새로 만들 때 함께 넣을 값(meta). */
export function RowMeta({ rid, block, meta, cb }: { rid: string; block: string; meta?: Record<string, any>; cb?: string[] }) {
  return (
    <>
      <input type="hidden" name="rid" value={rid} />
      <input type="hidden" name={`${rid}__@block`} value={block} />
      {meta && <input type="hidden" name={`${rid}__@meta`} value={JSON.stringify(meta)} />}
      {(cb || []).map((c) => <input key={c} type="hidden" name={`${rid}__@cb`} value={c} />)}
    </>
  );
}

/** 기록이 있으면 그 id, 없으면 새 줄 표시 id. */
export const ridOf = (r: Rec | undefined, fallback: string) => r?.rec_id || `NEW~${fallback}`;

const act_ = (op: string, arg = "") => act.bind(null, op, arg);
export const saveAct = act_("save");
export const addAct = (block: string, data: Record<string, any> = {}, hash = "form") => act_("add", JSON.stringify({ block, data, hash }));
export const delAct = (rid: string) => act_("del", rid);

/**
 * 증빙자료 칸. variant b = 「선택 파일 없음」 + 파일선택 버튼(명세 SCR-075·077) · a = 파일명 + ⤓ + 🗑 + 「+」(SCR-080·082·084·086).
 * slot 을 주면 그 자리 파일만 보이고 그 자리로 올린다.
 */
export function EvCell({ v, rid, files, all, slot = "", variant = "a" }: {
  v: View; rid: string; files: Ev[]; all?: Ev[]; slot?: string; variant?: "a" | "b";
}) {
  const list = all || files;
  const mine = files.filter((f) => (f.slot || "") === slot);
  const field = `${rid}__file${slot ? `_${slot}` : ""}`;
  return (
    <div className="use-ev">
      {mine.map((f) => {
        const idx = list.indexOf(f);
        return (
          <div className="use-ev-line" key={`${f.name}-${idx}`}>
            {f.url
              ? <Link className="us-ev-name use-ev-link" href={v.href(`&view=${encodeURIComponent(f.url)}&vn=${encodeURIComponent(f.name)}`)} scroll={false}>{f.name}</Link>
              : <span className="us-ev-name">{f.name}</span>}
            {f.url ? <a className="use-ico" href={f.url} download title="내려받기">⤓</a> : <span className="use-ico dim" title="내려받기">⤓</span>}
            {!rid.startsWith("NEW~") && <button className="use-ico" formAction={act_("delfile", `${rid}|${idx}`)} title="삭제">🗑</button>}
          </div>
        );
      })}
      {variant === "b" && (
        <div className="use-ev-line">
          <FilePick name={field} />
          {!mine.length && <><span className="use-ico dim">⤓</span><span className="use-ico dim">🗑</span></>}
        </div>
      )}
      {variant === "a" && !mine.length && (
        <div className="use-ev-line">
          <span className="us-ev-name empty">선택 파일 없음</span>
          <span className="use-ico dim">⤓</span><span className="use-ico dim">🗑</span>
        </div>
      )}
      <FilePick name={variant === "a" ? field : `${field}~2`} kind="plus" />
    </div>
  );
}

/** 회색 태그형 표시(명세 SCR-086·087 의 구분·조항 칸). */
export const Tag = ({ children, tone }: { children: React.ReactNode; tone?: "blue" | "mark" | "cond" }) =>
  <span className={`use-tag${tone ? ` ${tone}` : ""}`}>{children}</span>;

/** 「…없을 경우 체크하여 저장」 줄 — 체크하면 아래 .use-hide 가 사라진다(CSS :has, 스크립트 없음). */
export function NilLine({ rid, checked, text }: { rid: string; checked: boolean; text: string }) {
  return (
    <label className="use-nil">
      <RowMeta rid={rid} block="nil" cb={["nil"]} />
      <input type="checkbox" name={`${rid}__nil`} defaultChecked={checked} />
      <span className="use-nil-mark">✓</span>
      {text}
    </label>
  );
}

/** 좌상 「계획수립 내용 검색 및 추가」 — 불러오기 창을 연다. */
export const PlanBtn = ({ v, modal, extra = "" }: { v: View; modal: string; extra?: string }) =>
  <Link className="use-bbtn" href={v.href(`&modal=${modal}${extra}`)} scroll={false}>계획수립 내용 검색 및 추가</Link>;

/** 창(모달) — 주소 쿼리로 열고 닫는다. */
export function Modal({ v, title, crumb, children, wide }: { v: View; title: string; crumb?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="us-modal-bg">
      <div className={`us-modal use-modal${wide ? " wide" : ""}`}>
        <div className="us-modal-h"><span>{title}</span><Link href={v.href()} scroll={false} className="use-close" aria-label="닫기">✕</Link></div>
        <div className="us-modal-b">
          {crumb && <div className="use-crumb">{crumb}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}
export const CRUMB_MT = "계획·이행·점검   법 의무이행 조치   의무이행(원료 및 제조물)";

/** 예산 5분류 안내표(명세 SCR-079·084 — 읽기 전용, 원문 그대로). */
export function BudgetGuide() {
  const cols: [string, string[]][] = [
    ["안전점검비", ["시설물안전법 안전점검 등 비용", "관계 법령에 따른 안전점검 등 비용", "안전점검 등에 따른 조치·개선 비용", "안전점검 업무 수행인력 인건비"]],
    ["보수·보강비", ["시설물 보수·보강 등의 비용", "안전 관련 물품 및 보호구 등 구입비", "안전 관련 장비 등 구입 및 유지·보수 비용", "보수·보강 업무 수행인력 인건비"]],
    ["안전조치비", ["중대시민재해 예방을 위한 유해·위험요인 확인 및 점검 비용", "유해·위험요인 조치 및 개선 비용", "중대시민재해 발생시 대응 비용"]],
    ["교육·훈련비", ["안전 교육 및 훈련비", "안전 관련 행사추진 비용 (홍보비)"]],
    ["기타", ["안전관리 운영체계 관련 문서 등 개발 비용", "그 외 안전확보에 소요되는 비용"]],
  ];
  return (
    <table className="us-tbl use-guide">
      <thead><tr>{cols.map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody><tr>{cols.map(([h, xs]) => <td key={h}><ul>{xs.map((x) => <li key={x}>{x}</li>)}</ul></td>)}</tr></tbody>
    </table>
  );
}

/** 이미지 뷰어 — 파일 이름을 누르면(?view=) 그 파일, 아니면 이 단계의 가장 최근 그림 파일. */
export function Viewer({ v, recs, label = "이미지 뷰어" }: { v: View; recs: Rec[]; label?: string }) {
  const q = v.sp.view || "";
  const all = recs.flatMap((r) => r.files).filter((f) => f.url);
  const pick = q ? { url: q, name: v.sp.vn || "" } : [...all].reverse().find((f) => /\.(png|jpe?g|gif|webp)$/i.test(f.url));
  const url = pick?.url || "";
  const img = /\.(png|jpe?g|gif|webp)$/i.test(url);
  const pdf = /\.pdf$/i.test(url);
  return (
    <div className="us-viewer" id="viewer">
      <div className="us-viewer-h">{label}</div>
      <div className="us-viewer-b">
        {img ? <img src={url} alt={pick?.name || "증빙"} />
          : pdf ? <iframe className="use-pdf" src={url} title={pick?.name || "증빙"} />
          : url ? <a href={url} target="_blank">{pick?.name || "첨부 파일 열기"}</a>
          : <span className="us-ph">🖼</span>}
      </div>
    </div>
  );
}

/** 저장 · 추가 버튼 줄(명세: 좌 = 추가·불러오기, 우 = 저장). */
export function BtnRow({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return <div className="use-btnrow"><div className="use-btnrow-l">{left}</div><div>{right}</div></div>;
}
export const SaveBtn = ({ label = "저장" }: { label?: string }) => <button className="use-save" formAction={saveAct}>{label}</button>;
