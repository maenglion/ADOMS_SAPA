"use client";
/**
 * 내용이 칸보다 길어 잘릴 때만 맨 아래에 「더 있음」 꺽쇠를 띄우는 상자(09-24 사용자).
 *  · 넘치지 않으면 꺽쇠 없음 · 끝까지 내리면 사라짐 · 누르면 한 화면만큼 부드럽게 내려감
 *  · 아래쪽은 흐리게 번져 「더 있다」가 보이게
 */
import { useEffect, useRef, useState } from "react";

export default function ScrollBox({ className, children }: { className?: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const check = () => {
    const el = box.current;
    if (!el) return;
    setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 6);
  };
  useEffect(() => {
    check();
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => { ro.disconnect(); window.removeEventListener("resize", check); };
  }, []);
  return (
    <div className="usx-sbox">
      <div ref={box} className={className} onScroll={check}>{children}</div>
      {more && (
        <>
          <div className="usx-fade" aria-hidden="true" />
          <button type="button" className="usx-more" aria-label="아래 더 보기" title="아래 더 보기"
            onClick={() => box.current?.scrollBy({ top: box.current.clientHeight * 0.75, behavior: "smooth" })}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}
    </div>
  );
}
