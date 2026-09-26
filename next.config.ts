import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

function frozenSeedTracePlan(): { selected: string[]; historical: string[] } {
  const root = path.join(process.cwd(), "data", "_데모_용인시_20260920");
  const directories = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (entry.name.startsWith("us_") || entry.name.startsWith("ops_")))
    .map((entry) => entry.name);
  const ordered = [
    ...directories.filter((name) => name.startsWith("us_")).sort().reverse(),
    ...directories.filter((name) => name.startsWith("ops_")).sort().reverse(),
  ];
  const selected = new Map<string, string>();
  const all: string[] = [];
  for (const directory of ordered) {
    const seed = path.join(root, directory, "seed");
    if (!fs.existsSync(seed)) continue;
    for (const file of fs.readdirSync(seed).filter((name) => name.endsWith(".csv")).sort()) {
      const table = file.slice(0, -4);
      const relative = `./data/_데모_용인시_20260920/${directory}/seed/${file}`;
      all.push(relative);
      if (!selected.has(table)) {
        selected.set(table, relative);
      }
    }
  }
  const current = new Set(selected.values());
  return { selected: [...current], historical: all.filter((file) => !current.has(file)) };
}

const seedTrace = frozenSeedTracePlan();

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // 운영 모드(바탕화면 「ADOMS 400 열기」)는 빌드 결과를 .next-prod 에 따로 둔다 — 개발 서버(.next)와 부딪히지 않게(09-24)
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Dynamic fs reads cannot be inferred from the table name at build time.
  // Keep the frozen seed and generated statutory forms in every server route trace.
  outputFileTracingIncludes: {
    "/*": [
      ...seedTrace.selected,
      "./data/_데모_용인시_20260920/ops_*/forms/**/*",
    ],
  },
  outputFileTracingExcludes: {
    "/*": seedTrace.historical,
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
