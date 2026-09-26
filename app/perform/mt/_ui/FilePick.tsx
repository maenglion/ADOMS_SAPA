"use client";
// [400 · 교육자료 버전] 묶음 E — 파일 고르기 칸(고른 파일 이름을 상자에 바로 보인다). 저장은 폼의 저장 버튼이 한다.
import { useState } from "react";

/** kind: box(「선택 파일 없음」 상자 + 버튼) · plus(「+」 만) · btn(버튼만 — 옆에 이름) */
export default function FilePick({ name, label = "파일선택", kind = "box", empty = "선택 파일 없음" }: {
  name: string; label?: string; kind?: "box" | "plus" | "btn"; empty?: string;
}) {
  const [picked, setPicked] = useState("");
  const input = <input type="file" name={name} hidden onChange={(e) => setPicked(e.target.files?.[0]?.name || "")} />;
  if (kind === "plus") {
    return (
      <span className="use-pick">
        <label className="use-plus" title="파일 추가">+{input}</label>
        {picked && <span className="use-picked">{picked}</span>}
      </span>
    );
  }
  if (kind === "btn") {
    return (
      <span className="use-pick">
        <label className="us-btn-s">{label}{input}</label>
        {picked && <span className="use-picked">{picked}</span>}
      </span>
    );
  }
  return (
    <span className="use-pick">
      <span className={`us-ev-name${picked ? "" : " empty"}`}>{picked || empty}</span>
      <label className="us-btn-s">{label}{input}</label>
    </span>
  );
}
