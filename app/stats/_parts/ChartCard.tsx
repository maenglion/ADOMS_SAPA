"use client";
/**
 * [400 · 교육자료 버전] 차트 카드 — 참고 명세 08 §0-6 · SCR-093·094(공통 ChartCard).
 *  · 우상단(또는 좌상단) 차트 종류 전환 아이콘 3개: 막대 / 원(파이) / 선
 *  · 플롯 우상단 ⤓ → 「Export to」 팝업(xls · csv · png · jpeg) — SCR-094·096 주석 「다운로드 버튼 클릭 시, xls, csv, png, jpeg 확장자 다운로드 팝업 실행」
 * 외부 라이브러리 없이 인라인 SVG 로 그린다. xls·csv 는 서버(/stats/export)가 원본 수치 표를 내리고,
 * png·jpeg 는 브라우저에서 SVG 를 그림으로 바꿔 내려받는다.
 */
import { useRef, useState } from "react";

export type ChartType = "bar" | "pie" | "line";

// 참고 명세 화면의 차트 색(오피스 기본 색 순서) 관측치
const PALETTE = ["#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47", "#264478", "#9E480E", "#636363", "#997300", "#255E91", "#43682B"];
const LINE = "#00B0F0";

const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString("ko-KR") : String(Math.round(v * 100) / 100));
// 좌표는 소수 둘째 자리까지 — 서버 그림과 브라우저 그림이 글자 하나까지 같게(하이드레이션 불일치 방지, 09-24)
const q = (n: number) => Math.round(n * 100) / 100;

function niceStep(range: number) {
  if (range <= 0) return 1;
  const raw = range / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const c of [1, 2, 2.5, 5, 10]) if (c * mag >= raw) return c * mag;
  return 10 * mag;
}

type Props = {
  title: string;
  labels: string[];
  values: number[];
  unit?: string;               // 내보내기 표의 단위(건 · % · 개소 …)
  type?: ChartType;            // 처음 모양
  rotate?: boolean;            // X축 글자 기울임(45°)
  innerTitle?: boolean;        // 플롯 안에 제목(SCR-102)
  variant?: "card" | "plain";  // card = 둥근 회청색 카드(SCR-093) · plain = 아이콘 + 플롯만(SCR-095)
  toolsLeft?: boolean;         // 종류 전환 아이콘을 왼쪽에(SCR-095)
  height?: number;
  width?: number;              // 좁은 칸(3열)에서는 좁게 그려 글자가 작아지지 않게
};

export default function ChartCard({ title, labels, values, unit = "건", type = "bar", rotate, innerTitle, variant = "card", toolsLeft, height = 300, width = 500 }: Props) {
  const [kind, setKind] = useState<ChartType>(type);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const W = width, H = height;
  const rot = rotate ?? labels.length > 6;
  const svg = draw(kind, labels, values, W, H, rot, innerTitle ? title : "");

  const data = encodeURIComponent(JSON.stringify({ l: labels, v: values }));
  const href = (f: string) => `/stats/export?kind=chart&fmt=${f}&title=${encodeURIComponent(title)}&unit=${encodeURIComponent(unit)}&d=${data}`;

  function saveImage(mime: "image/png" | "image/jpeg") {
    const el = box.current?.querySelector("svg.usg-plot");
    if (!el) return;
    const xml = new XMLSerializer().serializeToString(el);
    const img = new Image();
    img.onload = () => {
      const s = 2, top = 34;
      const c = document.createElement("canvas");
      c.width = W * s; c.height = (H + top) * s;
      const g = c.getContext("2d")!;
      g.scale(s, s);
      g.fillStyle = "#fff"; g.fillRect(0, 0, W, H + top);
      g.fillStyle = "#222"; g.font = "bold 16px 'Malgun Gothic', sans-serif"; g.fillText(title, 12, 22);
      g.drawImage(img, 0, top, W, H);
      const a = document.createElement("a");
      a.download = `${title}.${mime === "image/png" ? "png" : "jpeg"}`;
      a.href = c.toDataURL(mime, 0.95);
      a.click();
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    setOpen(false);
  }

  const tools = (
    <span className="usg-tools" role="group" aria-label="차트 종류">
      {(["bar", "pie", "line"] as ChartType[]).map((k) => (
        <button key={k} type="button" className={kind === k ? "on" : ""} title={k === "bar" ? "막대" : k === "pie" ? "원" : "선"} onClick={() => setKind(k)}>
          <Icon k={k} />
        </button>
      ))}
    </span>
  );

  return (
    <div className={`usg-chart ${variant}`} ref={box}>
      {variant === "card" && (
        <div className="usg-chart-h">
          <b>{title}</b>
          {tools}
        </div>
      )}
      {variant === "plain" && <div className={`usg-chart-h plain${toolsLeft ? " left" : ""}`}>{tools}</div>}
      <div className="usg-plotbox">
        <button type="button" className="usg-dl" title="다운로드" onClick={() => setOpen(true)}>⤓</button>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        {open && (
          <>
            <div className="usg-export-bg" onClick={() => setOpen(false)} />
            <div className="usg-export" role="dialog" aria-label="Export to">
              <div className="usg-export-h">Export to</div>
              <div className="usg-export-b">
                <a href={href("xls")} onClick={() => setOpen(false)}>xlsx</a>
                {/* 09-26 사용자: 「일단 엑셀로만 하자」 — csv 선택지 뺌 */}
                <button type="button" onClick={() => saveImage("image/png")}><b>png</b></button>
                <button type="button" onClick={() => saveImage("image/jpeg")}>jpeg</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Icon({ k }: { k: ChartType }) {
  if (k === "bar") return <svg width="16" height="14" viewBox="0 0 16 14"><rect x="1" y="6" width="3" height="7" fill="currentColor" /><rect x="6" y="2" width="3" height="11" fill="currentColor" /><rect x="11" y="4" width="3" height="9" fill="currentColor" /></svg>;
  if (k === "pie") return <svg width="15" height="15" viewBox="0 0 16 16"><path d="M8 1 A7 7 0 1 0 15 8 L8 8 Z" fill="currentColor" /><path d="M9.5 0.5 A6.5 6.5 0 0 1 15.5 6.5 L9.5 6.5 Z" fill="currentColor" opacity=".55" /></svg>;
  return <svg width="16" height="14" viewBox="0 0 16 14"><polyline points="1,12 5,6 9,9 15,2" fill="none" stroke="currentColor" strokeWidth="1.8" /><line x1="1" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth=".8" /></svg>;
}

/* ── SVG 그리기(문자열) — 같은 자리·같은 크기에 모양만 바꾼다 ─────────────────── */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function draw(kind: ChartType, labels: string[], values: number[], W: number, H: number, rot: boolean, inner: string): string {
  const head = `<svg class="usg-plot" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="'Malgun Gothic','Noto Sans KR',sans-serif" role="img">`;
  const t = inner ? `<text x="14" y="20" font-size="13" fill="#333">${esc(inner)}</text>` : "";
  if (!labels.length) return `${head}${t}<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="15" fill="#888">자료 없음</text></svg>`;
  if (kind === "pie") return head + t + pie(labels, values, W, H) + "</svg>";

  const L = 46, R = 14, T = inner ? 36 : 22, B = rot ? 92 : 36;
  const pw = W - L - R, ph = H - T - B;
  const max = Math.max(...values, 0), min = Math.min(...values, 0);
  let lo = 0, step = niceStep(max);
  if (kind === "line" && labels.length > 1) {
    const mn = Math.min(...values), mx = Math.max(...values);
    step = niceStep(Math.max(mx - mn, 1));
    lo = Math.max(0, Math.floor((mn - step) / step) * step);
  }
  const hi = Math.max(Math.ceil((max + (kind === "line" ? step * 0.5 : 0)) / step) * step, lo + step);
  void min;
  const y = (v: number) => q(T + ph - ((v - lo) / (hi - lo)) * ph);
  const slot = pw / labels.length;
  const cx = (i: number) => q(L + slot * i + slot / 2);

  let s = t;
  // 눈금선·Y축 글자
  for (let v = lo; v <= hi + 1e-9; v += step) {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e1e1e1"/>`;
    s += `<text x="${L - 7}" y="${y(v) + 4}" text-anchor="end" font-size="13" fill="#555">${fmt(Math.round(v * 100) / 100)}</text>`;
  }
  // 세로 칸선(명세 화면처럼 칸마다)
  for (let i = 0; i <= labels.length; i++) s += `<line x1="${q(L + slot * i)}" x2="${q(L + slot * i)}" y1="${T}" y2="${T + ph}" stroke="#ececec"/>`;
  s += `<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" stroke="#999"/>`;

  // X축 글자
  labels.forEach((lb, i) => {
    const x = cx(i), yy = T + ph + 16;
    const txt = esc(lb.length > 14 ? lb.slice(0, 13) + "…" : lb);
    s += rot
      ? `<text x="${x}" y="${yy}" text-anchor="end" font-size="13" fill="#444" transform="rotate(-45 ${x} ${yy})">${txt}</text>`
      : `<text x="${x}" y="${yy}" text-anchor="middle" font-size="13.5" fill="#444">${txt}</text>`;
  });

  if (kind === "bar") {
    const bw = q(Math.min(slot * 0.62, 58));
    values.forEach((v, i) => {
      const x = q(cx(i) - bw / 2), top = y(Math.max(v, 0));
      s += `<rect x="${x}" y="${top}" width="${bw}" height="${q(Math.max(T + ph - top, v > 0 ? 1 : 0))}" fill="${PALETTE[i % PALETTE.length]}"/>`;
      s += `<text x="${cx(i)}" y="${top - 5}" text-anchor="middle" font-size="13.5" font-weight="700" fill="#333">${fmt(v)}</text>`;
    });
  } else {
    const pts = values.map((v, i) => `${cx(i)},${y(v)}`).join(" ");
    s += `<polyline points="${pts}" fill="none" stroke="${LINE}" stroke-width="3"/>`;
    values.forEach((v, i) => {
      s += `<circle cx="${cx(i)}" cy="${y(v)}" r="3" fill="${LINE}"/>`;
      s += `<text x="${cx(i) - 8}" y="${y(v) - 7}" text-anchor="end" font-size="13.5" fill="#333">${fmt(v)}</text>`;
    });
  }
  return head + s + "</svg>";
}

function pie(labels: string[], values: number[], W: number, H: number): string {
  const tot = values.reduce((a, b) => a + Math.max(b, 0), 0) || 1;
  const cx = W / 2, cy = H / 2 + 2, r = Math.min(W, H) / 2 - 34;
  let a = -Math.PI / 2, s = "";
  values.forEach((v, i) => {
    if (v <= 0) return;
    const ang = (v / tot) * Math.PI * 2, a2 = a + ang;
    const col = PALETTE[i % PALETTE.length];
    const large = ang > Math.PI ? 1 : 0;
    s += ang >= Math.PI * 2 - 1e-6
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}"/>`
      : `<path d="M${q(cx)},${q(cy)} L${q(cx + r * Math.cos(a))},${q(cy + r * Math.sin(a))} A${q(r)},${q(r)} 0 ${large} 1 ${q(cx + r * Math.cos(a2))},${q(cy + r * Math.sin(a2))} Z" fill="${col}" stroke="#fff" stroke-width="1"/>`;
    const m = a + ang / 2;
    if (ang > 0.14) s += `<text x="${q(cx + r * 0.66 * Math.cos(m))}" y="${q(cy + r * 0.66 * Math.sin(m) + 5)}" text-anchor="middle" font-size="13.5" font-weight="700" fill="#fff">${fmt(v)}</text>`;
    // 조각 밖 리더선 + 계열명(계열 색 글자) — 별도 범례 없음(SCR-093)
    const x1 = q(cx + r * Math.cos(m)), y1 = q(cy + r * Math.sin(m));
    const x2 = q(cx + (r + 14) * Math.cos(m)), y2 = q(cy + (r + 14) * Math.sin(m));
    const right = Math.cos(m) >= 0;
    const x3 = q(x2 + (right ? 10 : -10));
    s += `<polyline points="${x1},${y1} ${x2},${y2} ${x3},${y2}" fill="none" stroke="#999" stroke-width=".8"/>`;
    s += `<text x="${x3 + (right ? 3 : -3)}" y="${y2 + 4}" text-anchor="${right ? "start" : "end"}" font-size="12.5" fill="${col}">${esc(labels[i])}</text>`;
    a = a2;
  });
  return s;
}
