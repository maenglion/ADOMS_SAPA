import Link from "next/link";
import { FLOW, flowIndex, type FlowKey } from "@/lib/flow";

/**
 * 흐름 막대 — 지금 화면이 한 바퀴의 몇 번째인지, 앞뒤로 어디로 가는지 보여 준다. (2026-09-21)
 * 화면이 늘어도 흐름이 끊기지 않게 하는 장치다. 흐름 위의 화면은 모두 맨 위에 이것을 둔다.
 *
 * `next` 에 다음 단계로 **무엇을 들고 가는지**(예: 회차 번호)를 넘기면 그 값이 이어진다.
 */
export default function FlowBar({ step, role = "gm", carry = "", note }:
  { step: FlowKey; role?: string; carry?: string; note?: string }) {
  const i = flowIndex(step);
  const cur = FLOW[i];
  const prev = i > 0 ? FLOW[i - 1] : null;
  const next = i < FLOW.length - 1 ? FLOW[i + 1] : FLOW[0];
  const q = (href: string) => `${href}${href.includes("?") ? "&" : "?"}role=${role}${carry ? "&" + carry : ""}`;

  return (
    <div className="flowbar">
      <ol>
        {FLOW.map((s, k) => (
          <li key={s.key} className={k === i ? "on" : k < i ? "done" : ""}>
            <Link href={q(s.href)} title={`${s.who} — ${s.gives}`}>
              <span className="fno">{s.no}</span>{s.name}
            </Link>
          </li>
        ))}
      </ol>
      <div className="fnav">
        {prev
          ? <Link className="fbtn" href={q(prev.href)}>← {prev.no} {prev.name}</Link>
          : <span />}
        <span className="fnow">
          <b>{cur.no} {cur.name}</b> <span className="muted">· {cur.who} · 다음으로 넘기는 것: {cur.gives}</span>
          {note && <span className="muted"> · {note}</span>}
        </span>
        <Link className="fbtn next" href={q(next.href)}>
          {i === FLOW.length - 1 ? "다음 반기 ↻ " : ""}{next.no} {next.name} →
        </Link>
      </div>
    </div>
  );
}
