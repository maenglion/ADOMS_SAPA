"use client";
import { useEffect, useState } from "react";

const SIZES = [
  { k: "", label: "보통" },
  { k: "lg", label: "크게" },
  { k: "xl", label: "아주 크게" },
];

/** 글자 크기 전환 — html 의 기준 크기 하나만 바꾼다(브라우저에 기억). */
export default function FontSwitch() {
  const [fs, setFs] = useState("");

  useEffect(() => {
    const saved = (() => { try { return localStorage.getItem("adoms-fs") || ""; } catch { return ""; } })();
    setFs(saved);
    document.documentElement.dataset.fs = saved;
  }, []);

  const pick = (k: string) => {
    setFs(k);
    document.documentElement.dataset.fs = k;
    try { localStorage.setItem("adoms-fs", k); } catch {}
  };

  return (
    <div className="fs-switch">
      <span>글자 크기</span>
      {SIZES.map((s) => (
        <button key={s.k || "base"} className={fs === s.k ? "on" : ""} onClick={() => pick(s.k)} title={`글자 크기 ${s.label}`}>
          {s.label}
        </button>
      ))}
    </div>
  );
}
