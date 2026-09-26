"use client";
/**
 * [400 · 교육자료 버전] 경영방침 띠 — 한 항목씩 넘긴다(교육자료 화면의 ❙❙ = 멈춤).
 * 문구 원천: 용인시청 누리집 「용인시 안전보건 경영방침」(2025년 1월, 7개 항목)의 굵은 글씨를 줄인 것.
 *  https://www.yongin.go.kr/home/www/www11/www11_01/www11_01_12_01/www11_01_12_02.jsp
 */
import { useEffect, useState } from "react";

export const POLICY = [
  "안전문화 정착",
  "안전보건 경영체계 구축",
  "안전보건 목표 설정·교육훈련",
  "위험 예측·선제적 관리",
  "도급·용역·위탁 상생 협력",
  "안전개선 권한 부여·예산 우선 지원",
  "종사자 참여와 협의 보장",
];

export default function PolicyTicker() {
  const [i, setI] = useState(0);
  const [stop, setStop] = useState(false);
  useEffect(() => {
    if (stop) return;
    const t = setInterval(() => setI((x) => (x + 1) % POLICY.length), 3500);
    return () => clearInterval(t);
  }, [stop]);
  return (
    <>
      <button type="button" className="us-pause" onClick={() => setStop((s) => !s)} title={stop ? "넘기기" : "멈춤"} aria-label={stop ? "넘기기" : "멈춤"}>
        {stop ? "▶" : "❙❙"}
      </button>
      <span className="us-policy" key={i}>{i + 1}. {POLICY[i]}</span>
    </>
  );
}
