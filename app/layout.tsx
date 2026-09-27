import "./globals.css";
import "./us.css";
// [400] 화면 묶음별 모양 — 에이전트마다 자기 파일만 고친다
import "./us-a.css";
import "./us-b1.css";
import "./us-b2.css";
import "./us-c.css";
import "./us-d.css";
import "./us-e.css";
import "./us-f.css";
import "./us-g.css";
import "./us-lsx.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  metadataBase: new URL("https://adoms-runtime.netlify.app"),
  title: "중대재해처벌법의무이행관리시스템",
  description: "용인특례시 시연용",
  applicationName: "ADOMS",
  openGraph: {
    title: "중대재해처벌법의무이행관리시스템",
    description: "용인특례시 시연용",
    images: [{ url: "/adoms-og.png", width: 1200, height: 630, alt: "ADOMS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "중대재해처벌법의무이행관리시스템",
    description: "용인특례시 시연용",
    images: ["/adoms-og.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // 휴대폰에서 입력칸을 눌러도 화면이 확대되지 않게(16px 이상 글자와 함께 쓴다)
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 휴대폰 현장 등록 화면(/m)은 데스크톱 머리띠·메뉴 없이 본문만 보여 준다.
  const path = (await headers()).get("x-pathname") || "";
  const bare = path === "/m" || path.startsWith("/m/") || path === "/demo-admin" || path.startsWith("/demo-admin/");

  return (
    <html lang="ko">
      {/* 09-24 사용자: 가독성 좋은 앱 글꼴 — Pretendard(OFL · 한글 화면용). 인터넷이 없으면 맑은 고딕으로 돌아간다 */}
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body>{bare ? children : <Shell>{children}</Shell>}</body>
    </html>
  );
}
