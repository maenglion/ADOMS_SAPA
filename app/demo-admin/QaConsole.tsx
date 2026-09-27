"use client";
import { useCallback, useEffect, useState } from "react";

type EventRow = {
  id: string; occurred_at: string; event_type: string; route?: string; role?: string;
  http_status?: number; duration_ms?: number; cache_state?: string; success: boolean; detail?: Record<string, unknown>;
};
type PerfRow = { screen: string; http: number; cache: string; dbQueryCount: number | null; minMs: number; medianMs: number; maxMs: number };
type Snapshot = {
  ok: boolean;
  health?: { ready?: boolean; postgres?: boolean; cacheState?: string; responseCacheEntries?: number; warmTargetCount?: number; backend?: string };
  today?: { access: number; roleChange: number; writes: number; errors: number };
  recent?: EventRow[]; errors?: EventRow[]; writes?: EventRow[]; performance?: EventRow[];
  last?: { cacheReset?: string; prewarm?: string; performance?: string; error?: string };
};

const TABS = ["QA 현황", "시연 리뷰", "시연 데이터", "캐시 관리", "성능 점검"] as const;
type Tab = typeof TABS[number];
const time = (value?: string) => value ? new Date(value).toLocaleString("ko-KR") : "기록 없음";
const seconds = (value?: number | null) => value == null ? "-" : `${(value / 1000).toFixed(3)}s`;
const eventName: Record<string, string> = {
  qa_login: "QA 로그인", qa_logout: "QA 로그아웃", demo_session_start: "시연 시작", page_visit: "화면 접근", role_change: "역할 변경",
  write_success: "WRITE 성공", write_failure: "WRITE 실패", cache_reset: "캐시 초기화", prewarm_start: "재예열 시작",
  prewarm_complete: "재예열 완료", prewarm_failure: "재예열 실패", performance_check: "성능 점검", read_error: "READ 오류", server_error: "서버 오류",
};

export default function QaConsole() {
  const [tab, setTab] = useState<Tab>("QA 현황");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [perfBusy, setPerfBusy] = useState(false);
  const [perf, setPerf] = useState<{ ok: boolean; results: PerfRow[] } | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/demo-admin/qa", { cache: "no-store" });
    if (response.ok) setSnapshot(await response.json());
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function resetCache() {
    setResetBusy(true);
    setResetMessage("캐시를 초기화하고 있습니다...");
    const response = await fetch("/api/demo-admin/cache-reset", { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok) {
      setResetMessage(`캐시 초기화 및 재예열이 완료되었습니다. (${seconds(result.elapsedMs)})`);
      await refresh();
    } else {
      setResetMessage(result.error || "캐시 초기화에 실패했습니다.");
    }
    setResetBusy(false);
    setResetConfirm(false);
  }

  async function runPerformance() {
    setPerfBusy(true);
    const response = await fetch("/api/demo-admin/performance", { method: "POST" });
    const result = await response.json().catch(() => ({ ok: false, results: [] }));
    setPerf(result);
    setPerfBusy(false);
    await refresh();
  }

  const latestPerf = (snapshot?.performance?.[0]?.detail?.results || []) as PerfRow[];
  const shownPerf = perf?.results || latestPerf;
  const status = snapshot?.health;
  return (
    <main className="qa-shell">
      <header className="qa-header">
        <div><b>ADOMS QA</b><span>시연 운영 점검</span></div>
        <form action="/api/demo-admin/logout" method="post"><button type="submit">시연용 화면으로 돌아가기</button></form>
      </header>
      <nav className="qa-tabs" aria-label="QA 메뉴">{TABS.map((name) => <button key={name} className={tab === name ? "on" : ""} onClick={() => setTab(name)}>{name}</button>)}</nav>
      <section className="qa-content">
        {loading && <div className="qa-card">상태를 불러오고 있습니다...</div>}
        {!loading && tab === "QA 현황" && <>
          <h1>QA 현황</h1>
          <div className="qa-grid qa-grid-4">
            <StatusCard title="READ server" value={status?.ready ? "READY" : "ERROR"} ok={status?.ready} />
            <StatusCard title="PostgreSQL" value={status?.postgres ? "연결 정상" : "오류"} ok={status?.postgres} />
            <StatusCard title="Cache" value={status?.cacheState || "확인 필요"} ok={status?.cacheState === "READY"} />
            <StatusCard title="Production" value={`backend: ${status?.backend || "unknown"}`} ok={status?.backend === "read-server"} />
          </div>
          <h2>오늘 시연 현황</h2>
          <div className="qa-grid qa-grid-4">
            <NumberCard title="접속" value={snapshot?.today?.access} />
            <NumberCard title="역할 변경" value={snapshot?.today?.roleChange} />
            <NumberCard title="WRITE" value={snapshot?.today?.writes} />
            <NumberCard title="오류" value={snapshot?.today?.errors} danger={Boolean(snapshot?.today?.errors)} />
          </div>
          <div className="qa-grid qa-grid-2">
            <div className="qa-card"><h2>최근 상태</h2><dl className="qa-status-list"><dt>마지막 cache 초기화</dt><dd>{time(snapshot?.last?.cacheReset)}</dd><dt>마지막 prewarm 완료</dt><dd>{time(snapshot?.last?.prewarm)}</dd><dt>마지막 성능 점검</dt><dd>{time(snapshot?.last?.performance)}</dd><dt>마지막 오류</dt><dd>{time(snapshot?.last?.error)}</dd></dl></div>
            <div className="qa-card"><h2>최근 성능</h2>{latestPerf.length ? <dl className="qa-status-list">{latestPerf.map((row) => <span key={row.screen}><dt>{row.screen}</dt><dd>{seconds(row.medianMs)}</dd></span>)}</dl> : <p className="qa-muted">아직 성능 점검 기록이 없습니다.</p>}</div>
          </div>
        </>}
        {!loading && tab === "시연 데이터" && <>
          <h1>시연 데이터</h1><div className="qa-card"><h2>최근 시연 WRITE</h2><p className="qa-muted">업무 WRITE 기능을 새로 만들지 않고 실제 성공·실패 이력만 표시합니다.</p><EventTable rows={snapshot?.writes || []} /></div>
        </>}
        {!loading && tab === "캐시 관리" && <>
          <h1>캐시 관리</h1><div className="qa-card qa-control"><dl className="qa-status-list"><dt>현재 Cache 상태</dt><dd>{status?.cacheState || "확인 필요"}</dd><dt>마지막 초기화</dt><dd>{time(snapshot?.last?.cacheReset)}</dd><dt>마지막 prewarm</dt><dd>{time(snapshot?.last?.prewarm)}</dd><dt>현재 warm 대상</dt><dd>{status?.warmTargetCount ?? 0}개</dd></dl><button className="qa-primary" onClick={() => { setResetMessage(""); setResetConfirm(true); }}>캐시 초기화 및 재예열</button>{resetMessage && <p className={resetMessage.includes("완료") ? "qa-success" : "qa-error"}>{resetMessage}</p>}</div>
        </>}
        {!loading && tab === "성능 점검" && <>
          <div className="qa-title-row"><h1>성능 점검</h1><button className="qa-primary" disabled={perfBusy} onClick={runPerformance}>{perfBusy ? "점검 중..." : "성능 점검 실행"}</button></div>
          <div className="qa-card"><b className={`qa-state ${perf?.ok ? "ok" : perf ? "warn" : ""}`}>상태: {perf ? (perf.ok ? "정상" : "점검 필요") : "최근 결과"}</b><PerformanceTable rows={shownPerf} /></div>
        </>}
        {!loading && tab === "시연 리뷰" && <>
          <h1>시연 리뷰</h1><div className="qa-card"><h2>시간순 이벤트</h2><EventTable rows={snapshot?.recent || []} /></div><div className="qa-card"><h2>오류</h2><ErrorTable rows={snapshot?.errors || []} /></div>
        </>}
      </section>
      <footer className="qa-footer">
        <form action="/api/demo-admin/logout" method="post">
          <button type="submit" className="qa-back-home"><span aria-hidden="true">←</span> 시연용 홈으로 가기</button>
        </form>
      </footer>
      {resetConfirm && <div className="qa-modal-bg"><div className="qa-modal" role="dialog" aria-modal="true" aria-labelledby="qa-reset-title"><h2 id="qa-reset-title">캐시 초기화</h2><p>READ cache를 초기화하고 PostgreSQL 기준으로 다시 생성합니다.</p><div><button disabled={resetBusy} onClick={() => setResetConfirm(false)}>취소</button><button className="qa-primary" disabled={resetBusy} onClick={resetCache}>{resetBusy ? "처리 중..." : "초기화 및 재예열"}</button></div></div></div>}
    </main>
  );
}

function StatusCard({ title, value, ok }: { title: string; value: string; ok?: boolean }) { return <div className="qa-card qa-stat"><span>{title}</span><b className={ok ? "ok" : "bad"}>{value}</b></div>; }
function NumberCard({ title, value = 0, danger }: { title: string; value?: number; danger?: boolean }) { return <div className="qa-card qa-stat"><span>{title}</span><b className={danger ? "bad" : ""}>{value.toLocaleString()}회</b></div>; }
function PerformanceTable({ rows }: { rows: PerfRow[] }) { return rows.length ? <div className="qa-table-wrap"><table><thead><tr><th>화면</th><th>HTTP</th><th>Cache</th><th>DB Query</th><th>Min</th><th>Median</th><th>Max</th></tr></thead><tbody>{rows.map((row) => <tr key={row.screen}><td>{row.screen}</td><td>{row.http}</td><td>{row.cache}</td><td>{row.dbQueryCount ?? "-"}</td><td>{seconds(row.minMs)}</td><td>{seconds(row.medianMs)}</td><td>{seconds(row.maxMs)}</td></tr>)}</tbody></table></div> : <p className="qa-muted">성능 점검 기록이 없습니다.</p>; }
function EventTable({ rows }: { rows: EventRow[] }) { return rows.length ? <div className="qa-table-wrap"><table><thead><tr><th>시각</th><th>이벤트</th><th>역할</th><th>화면</th><th>결과</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{time(row.occurred_at)}</td><td>{eventName[row.event_type] || row.event_type}</td><td>{row.role || "-"}</td><td>{row.route || "-"}</td><td>{row.success ? "성공" : "실패"}</td></tr>)}</tbody></table></div> : <p className="qa-muted">기록이 없습니다.</p>; }
function ErrorTable({ rows }: { rows: EventRow[] }) { return rows.length ? <div className="qa-table-wrap"><table><thead><tr><th>시각</th><th>화면</th><th>HTTP</th><th>종류</th><th>내용</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{time(row.occurred_at)}</td><td>{row.route || "-"}</td><td>{row.http_status || "-"}</td><td>{String(row.detail?.kind || row.event_type)}</td><td>{String(row.detail?.message || "확인 필요")}</td></tr>)}</tbody></table></div> : <p className="qa-muted">최근 오류가 없습니다.</p>; }
