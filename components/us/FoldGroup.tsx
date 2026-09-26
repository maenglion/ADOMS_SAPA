"use client";
/**
 * 접는 묶음(09-24 사용자) — 대시보드 「중대재해 관리대상」의 사업장 · 공중이용시설 등 묶음 머리를 누르면 접히고 펴진다.
 * 접은 상태는 쿠키(adoms_fold)에 기억 — 다음에 새로 열어도 서버가 처음부터 접힌 채로 그린다(깜빡임 없음).
 */
import { useState } from "react";
import { Chev } from "./GroupSide";

const CK = "adoms_fold";
function saveFold(id: string, folded: boolean) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${CK}=([^;]*)`));
  const set = new Set((m ? decodeURIComponent(m[1]) : "").split(",").filter(Boolean));
  if (folded) set.add(id); else set.delete(id);
  document.cookie = `${CK}=${encodeURIComponent([...set].join(","))}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export default function FoldGroup({ id, folded: init, label, right, children, className, title }: {
  id: string; folded: boolean; label: React.ReactNode; right: React.ReactNode; children: React.ReactNode; className?: string; title?: string;
}) {
  const [folded, setFolded] = useState(init);
  const toggle = () => { const v = !folded; setFolded(v); saveFold(id, v); };
  return (
    <div className={`${className || ""}${folded ? " folded" : ""}`}>
      <button type="button" className="usa-d-row top ufold-btn" aria-expanded={!folded} onClick={toggle} title={title || (folded ? "펼치기" : "접기")}>
        <span className="ufold-l">{label}</span>
        <span className="ufold-r">
          <span>{right}</span>
          {/* 09-25 사용자: 꺽쇠는 의무이행 좌측 묶음과 같은 모양 — 펼침 ∨ · 접힘 > (같은 부품 Chev) */}
          <Chev />
        </span>
      </button>
      {!folded && children}
    </div>
  );
}
