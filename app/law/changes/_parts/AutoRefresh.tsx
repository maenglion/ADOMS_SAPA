"use client";
/** 확인 작업이 도는 동안 몇 초마다 화면을 다시 읽는다(끝나면 멈춘다). */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh({ on, ms = 4000 }: { on: boolean; ms?: number }) {
  const r = useRouter();
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => r.refresh(), ms);
    return () => clearInterval(t);
  }, [on, ms, r]);
  return null;
}
