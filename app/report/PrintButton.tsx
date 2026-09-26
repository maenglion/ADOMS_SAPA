"use client";

/** 인쇄 단추 — 브라우저 인쇄창을 연다. 거기서 「PDF로 저장」을 고르면 파일이 된다. */
export default function PrintButton() {
  return (
    <button className="btn" onClick={() => window.print()}>인쇄 · PDF로 저장</button>
  );
}
