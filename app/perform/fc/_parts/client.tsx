"use client";
/**
 * [400 · 교육자료 버전] 묶음 D — 화면에서 꼭 필요한 작은 움직임만(대상 셀렉터 · 파일 고르기 표시 · 전체 선택).
 * 저장은 전부 서버 액션(actions.ts)이 한다.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type Opt = { id: string; text: string; group: string };

/** 우상단 「대상」 셀렉터 — 고르면 같은 화면을 그 대상으로 다시 연다. */
export function TargetSelect({ hrefBase, value, options, label = "대상", param = "t" }:
  { hrefBase: string; value: string; options: Opt[]; label?: string; param?: string }) {
  const router = useRouter();
  const groups = [...new Set(options.map((o) => o.group))];
  return (
    <label className="usd-target">
      <b>{label}</b>
      <select className="usd-target-sel" value={value} aria-label={label}
        onChange={(e) => router.push(`${hrefBase}${hrefBase.includes("?") ? "&" : "?"}${param}=${encodeURIComponent(e.target.value)}`)}>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {options.filter((o) => o.group === g).map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export type EvFile = { name: string; url: string; view: string };

/**
 * 증빙자료 칸 — 파일명 상자 + 파일선택 + ⤓ + 🗑, 아래 「+」(파일 더하기). 개당 10MB 이하.
 * 고른 파일은 「저장」을 눌러야 올라간다 — 고른 이름을 상자에 먼저 보여 준다.
 */
export function FileBox({ name, files, clearIntent, pickLabel = "파일선택", accept, showPick = true, plus = true, extra }:
  { name: string; files: EvFile[]; clearIntent?: string; pickLabel?: string; accept?: string; showPick?: boolean; plus?: boolean; extra?: React.ReactNode }) {
  const [picked, setPicked] = useState<string[]>([]);
  const a = useRef<HTMLInputElement>(null);
  const b = useRef<HTMLInputElement>(null);
  const on = () => {
    const names = [...(a.current?.files || []), ...(b.current?.files || [])].map((f) => f.name);
    const big = [...(a.current?.files || []), ...(b.current?.files || [])].filter((f) => f.size > 10 * 1024 * 1024);
    if (big.length) alert(`개당 10MB 이하만 올릴 수 있습니다: ${big.map((f) => f.name).join(", ")}`);
    setPicked(names);
  };
  const first = files.find((f) => f.url);
  const trash = clearIntent && files.length
    ? <button className="usd-ico-btn" name="intent" value={clearIntent} title="첨부 파일 비우기">🗑</button>
    : <span className="us-ico dim">🗑</span>;
  return (
    <div className="usd-ev">
      <div className="us-ev">
        <span className={`us-ev-name${files.length || picked.length ? "" : " empty"}`} title={[...files.map((f) => f.name), ...picked].join(", ")}>
          {files.length || picked.length ? (
            <>
              {files.map((f, i) => (
                <a key={i} href={f.view} className="usd-evlink">{f.name}</a>
              ))}
              {picked.map((p, i) => <span key={`p${i}`} className="usd-picked">{p}(저장 전)</span>)}
            </>
          ) : "선택 파일 없음"}
        </span>
        {/* 순서: 표 줄 = 파일선택 ⤓ 🗑 (SCR-057) · 절차도 카드(extra 있음) = 🗑 찾아보기 저장 ⤓ (SCR-065) */}
        {extra && trash}
        {showPick && (
          <label className="us-btn-s">{pickLabel}
            <input ref={a} type="file" name={name} multiple hidden accept={accept} onChange={on} />
          </label>
        )}
        {extra}
        {first ? <a className="us-ico" href={first.url} target="_blank" title="내려받기">⤓</a> : <span className="us-ico dim">⤓</span>}
        {!extra && trash}
      </div>
      {plus && (
        <label className="usd-plus" title="파일 더하기">+
          <input ref={b} type="file" name={name} multiple hidden accept={accept} onChange={on} />
        </label>
      )}
    </div>
  );
}

/** 불러오기 팝업 머리의 전체 선택 ☐. */
export function CheckAll({ name = "pick" }: { name?: string }) {
  return (
    <input type="checkbox" aria-label="전체 선택" onChange={(e) => {
      const form = e.currentTarget.closest("form");
      form?.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${name}"]`).forEach((c) => { c.checked = e.currentTarget.checked; });
    }} />
  );
}
