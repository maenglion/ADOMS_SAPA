/** 법령 개정 화면 좌측 — 법 의무사항 › 법령 개정(개정 현황). 자동 확인 작업 기록은 관리자 메뉴(09-25). */
import Link from "next/link";
import MenuSide from "@/components/us/MenuSide";

export default function LawChangeSide({ page, role }: { page: "changes" | "runs"; role: string }) {
  const L = (href: string, label: string, on: boolean) => (
    <Link href={`${href}${href.includes("?") ? "&" : "?"}role=${role}`} className={on ? "on" : ""}>{on ? "◉ " : ""}{label}</Link>
  );
  // 09-25 사용자: 좌측 = 머리 메뉴 「법 의무사항」과 같은 구성(대상별 의무사항 · 의무 목록 · 법령 개정)
  void page; void L;
  return <MenuSide group="법 의무사항" />;
}
