"use client";
import { useEffect, useState } from "react";

/**
 * 증빙 사진 썸네일 — 누르면 크게 본다(참고 명세의 이미지 뷰어). (2026-09-21)
 * 같은 과제의 사진이 여러 장이면 좌우로 넘긴다. Esc 로 닫는다.
 * 사진이 아니면(PDF 등) 새 창으로 연다.
 */
export type Pic = { url: string; name: string; type?: string; meta?: string };

export default function Thumb({ pics, size = 40 }: { pics: Pic[]; size?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const imgs = pics.filter((p) => (p.type || "").startsWith("image/"));

  useEffect(() => {
    if (open === null) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % imgs.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + imgs.length) % imgs.length));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open, imgs.length]);

  if (imgs.length === 0) return null;
  const cur = open !== null ? imgs[open] : null;

  return (
    <>
      <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
        {imgs.map((p, i) => (
          <button key={p.url} type="button" onClick={() => setOpen(i)} className="thumbbtn" title={`${p.name} — 크게 보기`}>
            <img src={p.url} alt={p.name} style={{ width: size, height: size }} />
          </button>
        ))}
      </span>

      {cur && (
        <div className="lbox" onClick={() => setOpen(null)} role="dialog" aria-label="사진 크게 보기">
          <div className="lbox-in" onClick={(e) => e.stopPropagation()}>
            <img src={cur.url} alt={cur.name} />
            <div className="lbox-bar">
              <span><b>{cur.name}</b>{cur.meta ? <span className="muted"> · {cur.meta}</span> : null}</span>
              <span style={{ flex: 1 }} />
              {imgs.length > 1 && (
                <>
                  <button type="button" className="btn ghost sm" onClick={() => setOpen((open! - 1 + imgs.length) % imgs.length)}>←</button>
                  <span className="muted">{open! + 1} / {imgs.length}</span>
                  <button type="button" className="btn ghost sm" onClick={() => setOpen((open! + 1) % imgs.length)}>→</button>
                </>
              )}
              <a className="btn ghost sm" href={cur.url} download>내려받기</a>
              <button type="button" className="btn sm" onClick={() => setOpen(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
