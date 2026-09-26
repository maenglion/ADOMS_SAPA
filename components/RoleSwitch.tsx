"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

export const ROLES = [
  { id: "ceo", label: "경영책임자(시장)", dept: "", scope: "전 기관" },
  { id: "gm", label: "총괄(중대재해예방팀)", dept: "D01", scope: "전 기관" },
  { id: "mgr", label: "관리자(안전점검팀)", dept: "D02", scope: "소관 조직" },
  { id: "road_head", label: "부서장(도로구조물과장)", dept: "D03", scope: "소속 부서" },
  { id: "road", label: "실무자(도로구조물과)", dept: "D03", scope: "본인 배정분" },
  { id: "water_head", label: "부서장(상수도사업소 정수과장)", dept: "D04", scope: "소속 부서" },
  { id: "water", label: "실무자(상수도사업소)", dept: "D04", scope: "본인 배정분" },
];

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const cur = sp.get("role") || "gm";
  return (
    <>
      <span>역할</span>
      <select
        value={cur}
        onChange={(e) => {
          const p = new URLSearchParams(Array.from(sp.entries()));
          p.set("role", e.target.value);
          router.push(`?${p.toString()}`);
        }}
      >
        {ROLES.map((r) => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>
    </>
  );
}

export default function RoleSwitch() {
  return <Suspense fallback={<span>역할</span>}><Inner /></Suspense>;
}
