"use client";
/**
 * [400 · 교육자료 버전] 묶음 A — 고르면 바로 주소 값을 바꾸는 선택 상자(년도·대상).
 * 명세 SCR-006 · 011: select 변경 → 표 다시 조회. 나머지 주소 값은 그대로 둔다.
 */
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function ParamSelect({ name, value, options, className }: {
  name: string; value: string; options: { v: string; label: string }[]; className?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <select
      className={className || "usa-sel"}
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams(sp.toString());
        p.set(name, e.target.value);
        p.delete("modal");
        router.push(`${path}?${p.toString()}`);
      }}
    >
      {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );
}
