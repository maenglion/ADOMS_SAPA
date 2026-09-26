"use client";
/**
 * [400 · 교육자료 버전] 묶음 F — 목록 머리의 원형 토글(⌄) = 전체 선택/해제(참고 명세 SCR-089 · 추정).
 * 같은 폼 안의 name 칸을 모두 켜거나(하나라도 꺼져 있으면) 모두 끈다.
 */
export default function ToggleAll({ name, label }: { name: string; label: string }) {
  return (
    <button
      type="button"
      className="usf-dot usf-all"
      aria-label={label}
      title={label}
      onClick={(e) => {
        const f = (e.currentTarget as HTMLElement).closest("form");
        if (!f) return;
        const boxes = Array.from(f.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`));
        const all = boxes.every((b) => b.checked);
        boxes.forEach((b) => { b.checked = !all; });
      }}
    >
      ⌄
    </button>
  );
}
