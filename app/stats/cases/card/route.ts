// [400 · 교육자료 버전] 사고사례 카드뉴스 — 게시글 본문 「〈주요 사고 유형〉」 한 줄을 세로 카드 한 장(SVG)으로 그린다(09-24).
// 본문에 「카드뉴스 형태로 배포」라고 적혀 있는데 첨부가 비어 있던 것을 채운다. 글은 본문 그대로만 쓴다.
import { caseRows, caseCards, periodOf } from "../../_parts/data";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 낱말 단위 줄바꿈 — 한 줄 max 글자(한글 1 · 영숫자·기호 0.55) */
function wrap(s: string, max: number) {
  const w = (t: string) => [...t].reduce((a, c) => a + (/[ㄱ-힝]/.test(c) ? 1 : 0.55), 0);
  const out: string[] = [];
  let cur = "";
  for (const word of s.split(/\s+/)) {
    const nx = cur ? `${cur} ${word}` : word;
    if (w(nx) > max && cur) { out.push(cur); cur = word; } else cur = nx;
  }
  if (cur) out.push(cur);
  return out;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const no = u.searchParams.get("no") || "";
  const i = Number(u.searchParams.get("i")) || 1;
  const row = (await caseRows(true)).find((r) => String(r.case_no) === no);
  const card = row ? caseCards(row.content).find((c) => c.no === i) : undefined;
  if (!row || !card) return new Response("없음", { status: 404 });
  const period = periodOf(row.title);
  const W = 720, H = 900;
  const what = wrap(card.what, 13);
  const cause = wrap(card.cause || "-", 17);
  let y = 330;
  const whatSvg = what.map((l, k) => `<text x="60" y="${y + k * 62}" font-size="46" font-weight="800" fill="#1b2a1a">${esc(l)}</text>`).join("");
  y += what.length * 62 + 50;
  const causeTop = y;
  const causeSvg = cause.map((l, k) => `<text x="92" y="${causeTop + 96 + k * 46}" font-size="34" font-weight="600" fill="#7a1d12">${esc(l)}</text>`).join("");
  const causeH = 84 + cause.length * 46;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Pretendard','Malgun Gothic','Noto Sans KR',sans-serif">
<rect width="${W}" height="${H}" fill="#f6f8f4"/>
<rect width="${W}" height="190" fill="#2f6b2a"/>
<text x="60" y="84" font-size="30" font-weight="600" fill="#cfe6c8">중대재해 예방 · 사고사례 공유</text>
<text x="60" y="146" font-size="52" font-weight="800" fill="#fff">사고사례 ${"①②③④⑤"[i - 1] || i}</text>
<rect x="60" y="226" rx="26" width="${Math.max(150, [...card.sector].length * 34 + 60)}" height="52" fill="#fff" stroke="#2f6b2a" stroke-width="2"/>
<text x="90" y="262" font-size="30" font-weight="700" fill="#2f6b2a">${esc(card.sector)}</text>
${whatSvg}
<rect x="60" y="${causeTop}" width="${W - 120}" height="${causeH}" rx="18" fill="#fff1ee" stroke="#e3a79c"/>
<text x="92" y="${causeTop + 52}" font-size="28" font-weight="800" fill="#c0392b">사고 원인</text>
${causeSvg}
<text x="60" y="${H - 96}" font-size="30" font-weight="700" fill="#2f6b2a">사고유형별 안전수칙을 지켜 주세요</text>
<line x1="60" x2="${W - 60}" y1="${H - 70}" y2="${H - 70}" stroke="#c9d6c4"/>
<text x="60" y="${H - 34}" font-size="24" fill="#667">용인특례시 · ${esc(period || row.created_at)} 공유</text>
</svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" } });
}
