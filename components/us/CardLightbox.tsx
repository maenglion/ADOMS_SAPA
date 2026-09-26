"use client";
/**
 * 첨부 그림 크게 보기(화면 위에 띄움) — 09-26 사용자: 「사고사례 첨부 파일을 열고 나면 닫기 등 버튼이 없어 원래 페이지로 돌아갈 수 없다」.
 * 전: 새 탭(target=_blank)으로 그림 파일만 열렸다(앱 안 창에서는 같은 자리에 열려 돌아갈 길이 없었다).
 * 지금: 같은 화면 위에 띄우고 ✕ 닫기 · Esc · 바깥 누르기로 닫는다. 여러 장이면 ‹ › 로 넘긴다. 「내려받기」로 파일을 받는다.
 */
import { useEffect, useState } from "react";

export type LbItem = { src: string; name: string; alt?: string };

export default function CardLightbox({ items }: { items: LbItem[] }) {
  const [at, setAt] = useState<number | null>(null);
  const cur = at === null ? null : items[at];
  useEffect(() => {
    if (at === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAt(null);
      if (e.key === "ArrowRight") setAt((i) => (i === null ? i : Math.min(items.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setAt((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, items.length]);

  return (
    <>
      <div className="usg-cards">
        {items.map((c, i) => (
          <button key={c.src} type="button" className="usg-card" title="크게 보기" onClick={() => setAt(i)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.src} alt={c.alt || c.name} />
            <span>📎 {c.name}</span>
          </button>
        ))}
      </div>
      {cur && (
        <div className="lb-back" role="dialog" aria-modal="true" aria-label={cur.name} onClick={() => setAt(null)}>
          <div className="lb-box" onClick={(e) => e.stopPropagation()}>
            <div className="lb-head">
              <b>{cur.name}</b>
              <span className="lb-n">{at! + 1} / {items.length}</span>
              <a className="lb-btn" href={cur.src} download={cur.name}>내려받기</a>
              <button type="button" className="lb-x" onClick={() => setAt(null)} title="닫기(Esc)">✕</button>
            </div>
            <div className="lb-body">
              {items.length > 1 && <button type="button" className="lb-nav" disabled={at === 0} onClick={() => setAt(at! - 1)} aria-label="이전">‹</button>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cur.src} alt={cur.alt || cur.name} />
              {items.length > 1 && <button type="button" className="lb-nav" disabled={at === items.length - 1} onClick={() => setAt(at! + 1)} aria-label="다음">›</button>}
            </div>
            <div className="lb-foot"><button type="button" className="lb-close" onClick={() => setAt(null)}>닫기</button></div>
          </div>
        </div>
      )}
    </>
  );
}
