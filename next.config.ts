import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // 운영 모드(바탕화면 「ADOMS 400 열기」)는 빌드 결과를 .next-prod 에 따로 둔다 — 개발 서버(.next)와 부딪히지 않게(09-24)
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Dynamic fs reads cannot be inferred from the table name at build time.
  // Keep the frozen seed and generated statutory forms in every server route trace.
  outputFileTracingIncludes: {
    "/*": [
      "./data/_데모_용인시_20260920/us_*/seed/*.csv",
      "./data/_데모_용인시_20260920/ops_*/seed/*.csv",
      "./data/_데모_용인시_20260920/ops_*/forms/**/*",
    ],
  },

  // 화면 왼쪽 아래에 뜨는 개발 표시(동그란 N 아이콘)를 끈다.
  // 개발 중에만 보이는 것이지만, 현장에서 띄워 놓으면 눈에 거슬린다.
  devIndicators: false,

  experimental: {
    // 현장 사진을 여러 장 올린다. 서버 액션 기본 한도가 1MB 라 사진 한 장에도 막힌다.
    serverActions: { bodySizeLimit: "25mb" },
  },
};
export default nextConfig;
