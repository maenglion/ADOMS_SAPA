// 시연 참고 — 시연 시나리오(2026-09-24 · 시연 뒤 메뉴와 함께 없앤다). 장면 자료는 scenes.ts 한 곳.
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import { SCENES } from "./scenes";

export const dynamic = "force-dynamic";

const md = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>));

export default function DemoGuide() {
  const total = SCENES.reduce((s, x) => s + x.minutes, 0);
  return (
    <UsLayout>
      <div className="us-head usb2-head">
        <h1 className="us-h1">시연 시나리오 <span className="usb2-pre">시연 참고</span></h1>
      </div>
      <div className="dg-top">
        <div>장면 <b>{SCENES.length}</b>개 · 약 <b>{total}</b>분 · 바로가기는 새 창으로 열린다(이 화면은 옆에 띄워 두고 진행)</div>
        <div className="dg-toc">{SCENES.map((s) => <a key={s.no} href={`#sc${s.no}`}>{s.no}. {s.title}</a>)}</div>
      </div>
      {SCENES.map((s) => (
        <section key={s.no} id={`sc${s.no}`} className="dg-sc">
          <div className="dg-h"><span className="dg-no">{s.no}</span><h2>{s.title}</h2><span className="dg-min">{s.minutes}분</span></div>
          <p className="dg-why">{s.why}</p>
          <div className="dg-links">{s.links.map((l) => <Link key={l.href} href={l.href} target="_blank" className="dg-link">{l.label} ↗</Link>)}</div>
          <div className="dg-grid">
            <div><div className="dg-sub">순서</div><ol>{s.steps.map((x, i) => <li key={i}>{md(x)}</li>)}</ol></div>
            <div><div className="dg-sub">말할 것</div><ul>{s.say.map((x, i) => <li key={i}>{md(x)}</li>)}</ul></div>
          </div>
          {s.basis && (
            <div className="dg-basis"><div className="dg-sub">근거 조문(법령 원문 대조)</div>
              {s.basis.map((b, i) => <div key={i}><b>{b.law}</b> — 「{b.text}」</div>)}
            </div>
          )}
          {s.caution && (
            <div className="dg-caution"><div className="dg-sub">말하지 말 것 · 주의</div><ul>{s.caution.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          )}
        </section>
      ))}
    </UsLayout>
  );
}
