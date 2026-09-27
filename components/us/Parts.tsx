/**
 * [400 · 교육자료 버전] 공통 부품 — 참고 명세 00 §9 재사용 컴포넌트.
 *  UsLayout(좌측 사이드바 + 본문) · Side(대상 구분 + 의무 단계 아코디언) · PageHead · EvidenceCell(파일 칸)
 *  · EvidenceViewer(이미지 뷰어) · ExampleBox(증빙자료 예시) · StepNav(N단계 이전/다음) · StatusBadge · GradeBar
 * 모양은 app/us.css 의 us- 클래스만 쓴다.
 */
import { floor1 } from "@/lib/num";
import Link from "next/link";
import { TRACKS, GROUPS, STEPS, type TrackKey } from "@/lib/us/tracks";
import { US_GROUPS, type MenuItem } from "@/lib/menu";   // 09-26 사용자: 메뉴 밖 화면 합치기 — 좌측 「분야별 이행」「증빙」 판의 정의 원천
import { Chev } from "./GroupSide";
import SubLabel from "./SubLabel";

export function UsLayout({ side, children }: { side?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={side ? "us-wrap" : "us-wrap solo"}>
      {side}
      <section className="us-main">{children}</section>
    </div>
  );
}

/**
 * 좌측 2단 사이드바. 1단 = 대상 구분 3개, 2단 = 그 트랙의 의무 단계(①~④, ① 아래 1)~N)).
 * href(track, stepKey?) 로 각 화면 주소를 만든다. steps=false 면 1단만.
 */
export function Side({ panel, track, step, href, steps = true, tracks }: {
  panel: string; track: TrackKey; step?: string; href: (t: TrackKey, s?: string) => string;
  steps?: boolean; tracks?: { key: TrackKey; label: string }[];
}) {
  const list = tracks || TRACKS;
  const st = STEPS[track];
  const cur = st.find((s) => s.key === step);
  // 09-25 사용자: 의무이행 좌측을 머리 메뉴(사업장 · 공중이용시설·공중교통수단 · 원료·제조물)로 묶고 접었다 폈다.
  //   되돌리기 = SIDE_GROUPED 를 false 로(아래 옛 모양이 그대로 남아 있다)
  if (steps && SIDE_GROUPED) return <SideGrouped list={list} track={track} step={step} href={href} />;
  return (
    <aside className="us-side">
      <div className="us-panel">
        <div className="us-panel-h">{panel}</div>
        {list.map((t) => (
          <Link key={t.key} href={href(t.key)} className={t.key === track ? "on" : ""}>
            {t.key === track ? "◉ " : ""}{t.label}
          </Link>
        ))}
      </div>
      {steps && (
        <div className="us-steps">
          {([1, 2, 3, 4] as const).map((g) => {
            const items = st.filter((s) => s.group === g);
            const on = cur?.group === g;
            const one = items.length === 1 && !items[0].no;
            return (
              <div key={g} className={`us-g${on ? " on" : ""}`}>
                <Link className="us-g-h" href={href(track, items[0]?.key)}>
                  {/* 09-25 사용자: 원문자는 잘 안 보인다 — 숫자 배지로 · 뜻 없는 아래꺽쇠는 뺌 */}
                  <span className="us-num us-num2">{g}</span>
                  <span className="us-g-t">{GROUPS[track][g]}</span>
                </Link>
                {!one && (on || g === 1) && (
                  <div className="us-g-list">
                    {items.map((s) => (
                      <Link key={s.key} href={href(track, s.key)} className={s.key === step ? "on" : ""}>
                        {s.no}) {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

/** 의무이행 좌측 새 모양 켜기/끄기(09-25) — false 면 옛 모양(대상 3개 패널 + 지금 대상의 단계)으로 돌아간다 */
export const SIDE_GROUPED = true;

/**
 * 의무이행 좌측 새 모양 — 머리 메뉴의 하위 메뉴 이름(대상 3개)을 녹색 묶음 머리로, 그 아래에 그 대상의 단계(①~④ · 1)~N))를 둔다.
 * 묶음은 꺽쇠로 접었다 편다(브라우저 기본 details — 자바스크립트 없음). 지금 대상 묶음만 펼친 채로 연다.
 */
function SideGrouped({ list, track, step, href, cur }: {
  list: { key: TrackKey; label: string }[]; track?: TrackKey; step?: string; href: (t: TrackKey, s?: string) => string;
  cur?: string;   // 09-26 사용자: 메뉴 밖 화면 합치기 — 덧붙인 판(분야별 이행 · 증빙)에서 지금 화면의 주소(예: "/budget")
}) {
  return (
    <aside className="us-side">
      {list.map((t) => {
        const st = STEPS[t.key];
        const mine = t.key === track;
        const cur = mine ? st.find((s) => s.key === step) : undefined;
        return (
          <details key={t.key} className={`us-tgrp${mine ? " on" : ""}`} open={mine}>
            <summary className="us-panel-h">
              <span>{t.label}</span>
              <svg className="us-tgrp-chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </summary>
            <div className="us-steps">
              {([1, 2, 3, 4] as const).map((g) => {
                const items = st.filter((s) => s.group === g);
                if (!items.length) return null;
                const on = cur?.group === g;
                const one = items.length === 1 && !items[0].no;
                return (
                  <div key={g} className={`us-g${on ? " on" : ""}`}>
                    <Link className="us-g-h" href={href(t.key, items[0]?.key)}>
                      <span className="us-num us-num2">{g}</span>
                      <span className="us-g-t">{GROUPS[t.key][g]}</span>
                    </Link>
                    {!one && (on || g === 1) && (
                      <div className="us-g-list">
                        {items.map((s) => (
                          <Link key={s.key} href={href(t.key, s.key)} className={mine && s.key === step ? "on" : ""}>
                            {s.no}) {s.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
      {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 머리 메뉴 의무이행 묶음의 「분야별 이행」「증빙」을 같은 순서·같은 모양(꺽쇠)으로 */}
      {PERFORM_EXTRA && performExtraSecs().map((g) => {
        const mine = g.items.some((m) => m.href === cur);
        return (
          <details key={g.head} className={`us-tgrp us-tgrp-l${mine ? " on" : ""}`} open={mine}>
            <summary className="us-panel-h"><span>{g.head}</span><Chev /></summary>
            <div className="us-tgrp-list">
              {g.items.map((m) => (
                <Link key={m.href} href={m.href} className={m.href === cur ? "on" : ""}>{m.href === cur ? "◉ " : ""}<SubLabel text={m.label} /></Link>
              ))}
            </div>
          </details>
        );
      })}
    </aside>
  );
}

/** 09-26 사용자: 메뉴 밖 화면 합치기 — 좌측 덧붙인 판 켜기/끄기. 되돌리기 = false(대상 3개 묶음만 남는다). */
export const PERFORM_EXTRA = true;

/**
 * 09-26 사용자: 메뉴 밖 화면 합치기 — 머리 메뉴(lib/menu.ts US_GROUPS 「의무이행(실적증빙)」)의 소제목 판 가운데
 * 대상별 이행(/perform/… — 위 대상 3개 묶음이 맡는다)을 뺀 나머지(분야별 이행 · 증빙)를 그 순서 그대로 꺼낸다.
 * 메뉴를 고치면 좌측도 함께 바뀐다(정의는 menu.ts 한 곳). 권한·숨김은 머리 메뉴의 sideHideCss 가 가린다.
 */
function performExtraSecs(): { head: string; items: MenuItem[] }[] {
  const g = US_GROUPS.find((x) => x.label.replace(/\n/g, "") === "의무이행(실적증빙)");
  const secs: { head: string; items: MenuItem[] }[] = [];
  for (const m of g?.items || []) {
    if (m.heading) secs.push({ head: m.label, items: [] });
    else if (m.href && !m.hideInDemo) {
      if (!secs.length) secs.push({ head: "의무이행", items: [] });
      secs[secs.length - 1].items.push(m);
    }
  }
  return secs.filter((s) => s.items.length && !s.items.every((m) => m.href.startsWith("/perform/")));
}

/**
 * 09-26 사용자: 메뉴 밖 화면 합치기 — 의무이행 묶음 화면(분야별 이행 · 증빙 · 체계 기록)의 좌측.
 * 의무이행 단계 화면과 같은 좌측(대상 3개 묶음 + 분야별 이행 + 증빙)을 그린다.
 *  · track/step 을 주면 그 대상 묶음을 펼치고 그 단계를 켠다(체계 기록처럼 단계와 같은 호를 다루는 화면)
 *  · cur 를 주면 덧붙인 판에서 그 항목을 켠다(예: "/budget", "/evidence?view=ledger")
 * 역할(role)은 주소에 싣지 않는다 — 미들웨어가 쿠키로 붙인다(머리 메뉴·MenuSide 와 같다).
 */
export function PerformSide({ track, step, cur }: { track?: TrackKey; step?: string; cur?: string }) {
  return <SideGrouped list={TRACKS} track={track} step={step} cur={cur} href={(t, s) => `/perform/${t}${s ? `/${s}` : ""}`} />;
}

export function PageHead({ sub, title, meta, target, right }: {
  sub?: string; title: string; meta?: string; target?: string; right?: React.ReactNode;
}) {
  return (
    <div className="us-head">
      <div>
        {sub && <div className="us-head-sub">{sub}</div>}
        <h1 className="us-h1">{title}</h1>
        {meta && <div className="us-head-meta">{meta}</div>}
      </div>
      <div className="us-head-r">
        {target && <span className="us-target"><b>대상</b><span className="us-pill">{target}</span></span>}
        {right}
      </div>
    </div>
  );
}

/** 증빙자료 칸 — 파일명 상자 + 파일선택 + 내려받기·삭제 표시. name 은 폼 파일 칸 이름. */
export function EvidenceCell({ name = "evidence_file", fileName, url }: { name?: string; fileName?: string; url?: string }) {
  return (
    <div className="us-ev">
      <span className={`us-ev-name${fileName ? "" : " empty"}`}>{fileName || "선택된 파일 없음"}</span>
      <label className="us-btn-s">파일선택<input type="file" name={name} hidden /></label>
      {url ? <a className="us-ico" href={url} target="_blank">다운로드</a> : <span className="us-ico dim">-</span>}
      <span className="us-ico dim" title="삭제">🗑</span>
    </div>
  );
}
export const EvHead = () => <>증빙자료<br /><small>※개당 10MB 이하</small></>;

export function EvidenceViewer({ url, name }: { url?: string; name?: string }) {
  const img = url && /\.(png|jpe?g|gif|webp)$/i.test(url);
  return (
    <div className="us-viewer">
      <div className="us-viewer-h">이미지 뷰어</div>
      <div className="us-viewer-b">
        {img ? <img src={url} alt={name || "증빙"} /> : url ? <a href={url} target="_blank">{name || "첨부 파일 열기"}</a> : <span className="us-ph">🖼</span>}
      </div>
    </div>
  );
}

export function ExampleBox({ title = "증빙자료 예시", items, ordered }: { title?: string; items: string[]; ordered?: boolean }) {
  return (
    <div className="us-example">
      <div className="us-example-h">{title}</div>
      {ordered
        ? <ol>{items.map((x, i) => <li key={i}>{x}</li>)}</ol>
        : <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>}
    </div>
  );
}

export function StepNav({ prev, next }: { prev?: { href: string; label: string } | null; next?: { href: string; label: string } | null }) {
  return (
    <div className="us-stepnav">
      {prev ? <Link className="us-stepbtn" href={prev.href}>&lt; {prev.label}</Link> : <span />}
      {next ? <Link className="us-stepbtn" href={next.href}>{next.label} &gt;</Link> : <span />}
    </div>
  );
}

const ST: Record<string, string> = { 이행완료: "ok", 보완필요: "warn", 미이행: "bad", 해당없음: "none", O: "ok", "△": "warn", X: "bad", "-": "none" };
export function StatusBadge({ s }: { s: string }) {
  return <span className={`us-st ${ST[s] || "none"}`}>{s}</span>;
}

/** 이행률 등급 — 임계값은 설정값(명세 00 §6: 80 이상 우수 · 70 이상 보통 · 그 밖 미흡 — 추정). */
export const GRADE = { good: 80, mid: 70 };
export const gradeOf = (p: number) => (p >= GRADE.good ? "우수" : p >= GRADE.mid ? "보통" : "미흡");
export function GradeBar({ pct }: { pct: number }) {
  const g = gradeOf(pct);
  return (
    <div className="us-grade">
      {["우수", "보통", "미흡"].map((x) => <span key={x} className={`g-${x}${x === g ? " on" : ""}`}>{x}</span>)}
    </div>
  );
}
export const pctText = (n: number) => `${floor1(n).toFixed(1)}%`;   // 09-24 소수점 한 자리 · 09-26 사용자: 이행률 소수점은 모두 버림(lib/num.ts)
