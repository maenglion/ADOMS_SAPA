import Link from "next/link";
import { TONE, PALETTE, TRACK } from "@/lib/theme";

/**
 * 그래프 — 막대와 도넛(파이) 두 가지. 인라인 SVG 라 라이브러리를 쓰지 않는다.
 * 레이아웃을 바꾸지 않는다: 같은 자리에 같은 크기로 그리고 모양만 갈아 끼운다.
 */

export type Slice = { label: string; n: number; tone?: "ok" | "warn" | "bad" | "none" | "" };

// 색은 lib/theme.ts 한 곳에서만 정한다(화면에 색을 박지 않는다).
const COLOR: Record<string, string> = TONE as any;

/** 도넛 — 가운데에 핵심 수치 하나를 크게 둔다. */
export function Donut({ slices, center, sub, size = 190 }:
  { slices: Slice[]; center?: string; sub?: string; size?: number }) {
  const total = slices.reduce((s, x) => s + x.n, 0) || 1;
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, w = 26;
  let acc = 0;

  const arc = (from: number, to: number) => {
    // 한 바퀴를 다 도는 조각은 원 두 개로 그린다(호로는 못 그린다).
    if (to - from >= 0.9999) {
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
    }
    const a1 = from * 2 * Math.PI - Math.PI / 2, a2 = to * 2 * Math.PI - Math.PI / 2;
    const large = to - from > 0.5 ? 1 : 0;
    return `M ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)}`;
  };

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="도넛 그래프">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={TRACK} strokeWidth={w} />
        {slices.map((s, i) => {
          const from = acc / total; acc += s.n; const to = acc / total;
          if (s.n <= 0) return null;
          return <path key={i} d={arc(from, to)} fill="none" strokeWidth={w}
                       stroke={s.tone !== undefined ? COLOR[s.tone] : PALETTE[i % PALETTE.length]} strokeLinecap="butt" />;
        })}
        {center && (
          <>
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize={size * 0.21} fontWeight="800" fill="#1f4a7a">{center}</text>
            {sub && <text x={cx} y={cy + size * 0.13} textAnchor="middle" fontSize={size * 0.085} fill="#5a6572">{sub}</text>}
          </>
        )}
      </svg>
      <div style={{ minWidth: 190 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 0" }}>
            <i style={{
              width: 13, height: 13, borderRadius: 3, display: "inline-block",
              background: s.tone !== undefined ? COLOR[s.tone] : PALETTE[i % PALETTE.length],
            }} />
            <span style={{ flex: 1 }}>{s.label}</span>
            <b>{s.n.toLocaleString()}</b>
            <span className="muted" style={{ width: 52, textAlign: "right" }}>
              {Math.round((s.n / total) * 100)}%
            </span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0 0",
                      marginTop: 4, borderTop: "1px solid var(--line)" }}>
          <i style={{ width: 13 }} />
          <span style={{ flex: 1, fontWeight: 700, color: "var(--navy)" }}>합계</span>
          <b>{slices.reduce((a, x) => a + x.n, 0).toLocaleString()}</b>
          <span className="muted" style={{ width: 52, textAlign: "right" }}>100%</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 가로 막대 묶음 — 도넛과 같은 자료를 같은 자리에 그린다.
 *
 * ★ 2026-09-21 정정 — 막대 길이와 옆의 % 가 서로 다른 기준이었다(사용자 지적).
 *   길이는 **가장 큰 값**을 100 으로 잡고, % 는 **합계** 대비로 적었다.
 *   그래서 막대가 꽉 찬 줄에 「41%」가 붙는 일이 생겼다.
 *   이제 둘 다 **합계 대비**로 맞춘다 — 막대 길이 = 그 줄의 %. 합계도 맨 아래에 적는다.
 */
export function BarGroup({ slices, unit = "건" }: { slices: Slice[]; unit?: string }) {
  const total = slices.reduce((s, x) => s + x.n, 0);
  const denom = total || 1;
  return (
    <div>
      {slices.map((s, i) => {
        const share = (s.n / denom) * 100;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
            <span style={{ width: 170 }}>{s.label}</span>
            <div className="bar" style={{ flex: 1 }}>
              <i style={{
                // 값이 있는데 막대가 아예 안 보이면 오해를 부른다 — 최소 두께를 준다.
                width: `${s.n > 0 ? Math.max(share, 1.2) : 0}%`,
                background: s.tone !== undefined ? COLOR[s.tone] : PALETTE[i % PALETTE.length],
              }} />
            </div>
            <b style={{ width: 70, textAlign: "right" }}>{s.n.toLocaleString()}</b>
            <span className="muted" style={{ width: 52, textAlign: "right" }}>
              {share > 0 && share < 0.5 ? "0.5% 미만" : `${Math.round(share)}%`}
            </span>
          </div>
        );
      })}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0 0",
                    marginTop: 4, borderTop: "1px solid var(--line)" }}>
        <span style={{ width: 170, fontWeight: 700, color: "var(--navy)" }}>합계</span>
        <div style={{ flex: 1 }} />
        <b style={{ width: 70, textAlign: "right" }}>{total.toLocaleString()}</b>
        <span className="muted" style={{ width: 52, textAlign: "right" }}>{unit}</span>
      </div>
    </div>
  );
}

/** 막대 ↔ 도넛 전환 단추. 주소에 ?g=pie 로 남아 새로고침해도 유지된다. */
export function ChartSwitch({ base, sp, cur }: { base: string; sp: Record<string, string>; cur: string }) {
  const href = (g: string) => {
    const p = new URLSearchParams(sp);
    if (g) p.set("g", g); else p.delete("g");
    return `${base}?${p.toString()}`;
  };
  return (
    <span className="chips" style={{ margin: 0 }}>
      <Link className={`chip ${cur !== "pie" ? "on" : ""}`} href={href("")}>막대</Link>
      <Link className={`chip ${cur === "pie" ? "on" : ""}`} href={href("pie")}>파이</Link>
    </span>
  );
}

/** 카드형 ↔ 표형 전환 단추. */
export function ViewSwitch({ base, sp, cur }: { base: string; sp: Record<string, string>; cur: string }) {
  const href = (v: string) => {
    const p = new URLSearchParams(sp);
    if (v) p.set("v", v); else p.delete("v");
    return `${base}?${p.toString()}`;
  };
  return (
    <span className="chips" style={{ margin: 0 }}>
      <Link className={`chip ${cur === "card" ? "on" : ""}`} href={href("card")}>카드형</Link>
      <Link className={`chip ${cur !== "card" ? "on" : ""}`} href={href("")}>표형</Link>
    </span>
  );
}
