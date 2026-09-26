// [400 · 교육자료 버전] SCR-089 이행점검 — 취합 대상 설정(사업장·부서 × 점검 항목 → 취합 시작)
import Link from "next/link";
import { redirect } from "next/navigation";
import { UsLayout } from "@/components/us/Parts";
import { deptOf } from "@/lib/roles";
import { staff, readTable, type Row } from "@/lib/data";
import { isTrack, itemsOf, deptsOf, roundsOf, splitIds, HQ, fmtAt, oldBatchesOf, periodChecks, halfOf } from "../_lib";
import { CheckSide, CheckHead, CheckOldLinks } from "../_parts";   // 09-26 사용자: 메뉴 밖 화면 합치기 — CheckOldLinks
import { OLD_CHECK_MERGED } from "@/lib/check_merge";   // 09-26 사용자: 옛 점검 화면 합치기 — 되돌리기 스위치
import { ymd } from "@/lib/day";
import ToggleAll from "../ToggleAll";
import { startRound } from "./actions";

export const dynamic = "force-dynamic";

export default async function CheckSetup({ params, searchParams }: {
  params: Promise<{ track: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { track } = await params;
  const sp = await searchParams;
  const role = sp.role || "gm";
  if (!isTrack(track)) redirect(`/check/ws?role=${role}`);

  const all = await deptsOf(track);
  // 사업장 트랙 — 사업장 20곳(09-24 · 전부 확인 필요)을 고를 수 있게 하되, 이행 과제는 용인시청 본청 부서에만 있다
  const wpNames = track === "ws"
    ? (await readTable("usb1_workplace", "wp_id")).filter((w) => w.deleted !== "Y")
        .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0)).map((w) => String(w.wp_name))
    : [];
  const sites = [...new Set([...all.map((d) => d.site), ...wpNames])];
  const site = sp.site || "";
  const q = (sp.q || "").trim();
  const list = all.filter((d) => (!site || d.site === site) && (!q || d.label.includes(q)));
  const items = itemsOf(track);

  // 처음 선택 — 담당자 역할은 자기 부서, 그 밖에는 지난 취합의 사업장·부서(없으면 과제·기록이 있는 부서)
  const rounds = await roundsOf(track);
  const mine = deptOf(role);
  const last = rounds[0] ? splitIds(rounds[0].dept_ids).filter((d) => all.some((x) => x.dept_id === d)) : [];
  const pre = new Set(
    mine && all.some((d) => d.dept_id === mine) && role !== "mgr"
      ? [mine]
      : last.length ? last : all.filter((d) => d.taskN > 0).map((d) => d.dept_id),
  );
  const st = await staff();
  const nm = new Map(st.map((s: Row) => [s.staff_id, String(s.display_name || "")]));
  // 09-26 사용자: 옛 점검 화면 합치기 — 옛 점검 계획(회차·법정 점검 주기)을 이 화면으로. 옛 회차는 기록으로만 보인다(새로 열지 않는다).
  const olds = await oldBatchesOf(track);
  const nowY = ymd().slice(0, 4), nowH = halfOf();
  const pcs = await periodChecks(track, nowY, nowH);
  const pcShort = pcs.filter((p) => p.state === "없음" || p.state === "진행 중").length;
  const hist = [
    ...rounds.map((r) => ({ kind: "round" as const, at: String(r.created_at || ""), r })),
    ...olds.map((o) => ({ kind: "batch" as const, at: String(o.batch.started_at || ""), o })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <UsLayout side={<CheckSide track={track} role={role} />}>
      <CheckHead track={track} sub="취합 대상 설정" />
      {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 점검 회차 계획·점검 판정·회차 결재로 들어가는 길 */}
      {/* 09-26 사용자: 옛 점검 화면 합치기 — 합친 뒤에는 옛 화면으로 들어가는 줄을 두지 않는다(스위치로 되돌림) */}
      {!OLD_CHECK_MERGED && <CheckOldLinks track={track} role={role} />}

      <form className="usf-search" method="get">
        <input type="hidden" name="role" value={role} />
        <label>사업장
          <select name="site" defaultValue={site}>
            <option value="">전체</option>
            {sites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="usf-grow">사업장명
          <input type="text" name="q" defaultValue={q} placeholder="사업장 또는 부서명을 입력하세요" />
        </label>
        <button className="usf-sbtn" type="submit">🔍검색</button>
      </form>

      {sp.err && <p className="usf-err">{sp.err === "dept" ? "사업장·부서를 하나 이상 고르세요." : "항목을 하나 이상 고르세요."}</p>}

      <form action={startRound}>
        <input type="hidden" name="track" value={track} />
        <input type="hidden" name="role" value={role} />
        <div className="usf-pick">
          <div className="usf-list">
            <div className="usf-list-h"><span>사업장명</span><ToggleAll name="dept" label="사업장 전체 선택/해제" /></div>
            {list.map((d) => (
              <label key={d.dept_id}>
                <span>{d.site} &nbsp;:&nbsp; {d.dept_name}</span>
                <input className="usf-tg" type="checkbox" name="dept" value={d.dept_id} defaultChecked={pre.has(d.dept_id)} />
                <span className="usf-dot" aria-hidden>⌄</span>
              </label>
            ))}
            {!list.length && <div className="usf-none">{site && !all.some((d) => d.site === site) ? "이 사업장에는 아직 점검할 이행 과제가 없습니다(과제 없음)." : "찾는 사업장·부서가 없습니다."}</div>}
          </div>
          <div className="usf-list">
            <div className="usf-list-h"><span>항목</span><ToggleAll name="item" label="항목 전체 선택/해제" /></div>
            {items.map((it) => (
              <label key={it.key}>
                <span>{it.no}. {it.label}</span>
                <input className="usf-tg" type="checkbox" name="item" value={it.key} defaultChecked />
                <span className="usf-dot" aria-hidden>⌄</span>
              </label>
            ))}
          </div>
        </div>
        <div className="usf-go"><button className="us-btn w usf-gobtn" type="submit">취합 시작</button></div>
      </form>

      {track === "ws" && <p className="us-muted usf-note">사업장은 {wpNames.length || 1}곳(사업장 단위는 용인시 확인 필요)이며, 이행 과제는 {HQ} 소속 부서에 있어 부서 단위로 취합합니다.</p>}

      {/* 09-26 사용자: 옛 점검 화면 합치기 — 옛 점검 계획의 「점검 주기」를 이 화면에서(이행점검 회차 + 옛 회차를 함께 센다) */}
      <details className="us-card w f26-fold" id="old-plan" open={pcShort > 0 || Boolean(sp.b)}>
        <summary>
          법정 점검 주기 · {nowY}년 {nowH}
          {pcShort > 0 ? <span className="us-st warn">결재 전 {pcShort}</span> : <span className="us-st ok">모두 충족</span>}
        </summary>
        <table className="us-tbl f26-tbl">
          <thead><tr><th>항목</th><th>법정 주기</th><th>근거</th><th>기한</th><th>이번 기간</th></tr></thead>
          <tbody>
            {pcs.map((p) => (
              <tr key={p.item.key}>
                <td>{p.item.no}. {p.item.label}</td>
                <td className="c">{p.cycle}</td>
                <td>{p.basis}</td>
                <td className="c">{p.due || "-"}</td>
                <td>
                  {p.state === "주기 없음" ? <span className="us-muted">-</span>
                    : <><span className={`us-st ${p.state === "충족" ? "ok" : "warn"}`}>{p.state === "충족" ? "결재완료" : p.state === "진행 중" ? "결재 전" : "회차 없음"}</span>{p.by && <small className="f26-by"> {p.by}</small>}</>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="us-muted f26-note">주기는 중대재해처벌법 시행령 원문 기준입니다. 이 화면의 취합(이행점검 회차)과 지난 반기 점검 회차를 함께 셉니다.</p>
      </details>

      {hist.length > 0 && (
        <>
          <h2 className="us-h2">취합 이력</h2>
          <table className="us-tbl">
            <thead><tr><th>취합일</th><th>점검명</th><th>사업장·부서</th><th>항목</th><th>취합자</th><th>상태</th><th>보기</th></tr></thead>
            <tbody>
              {hist.map((h) => h.kind === "round" ? (
                <tr key={h.r.round_id}>
                  <td className="c">{fmtAt(h.r.created_at).slice(0, 10)}</td>
                  <td>{h.r.title}</td>
                  <td className="c">{splitIds(h.r.dept_ids).length}</td>
                  <td className="c">{splitIds(h.r.item_keys).length}</td>
                  <td className="c">{nm.get(h.r.created_by) || h.r.created_by}</td>
                  <td className="c"><span className={`us-st ${h.r.status === "결재완료" ? "ok" : "warn"}`}>{h.r.status}</span></td>
                  <td className="c">
                    <Link className="us-btn-s" href={`/check/${track}/review?role=${role}&r=${h.r.round_id}`}>점검</Link>{" "}
                    <Link className="us-btn-s" href={`/check/${track}/summary?role=${role}&r=${h.r.round_id}`}>총괄표</Link>
                  </td>
                </tr>
              ) : (
                // 09-26 사용자: 옛 점검 화면 합치기 — 과제 단위 반기 점검 회차(기록). 판정은 항목별 점검에 과제별 세부로, 결재 기록은 총괄표 아래에 보인다.
                <tr key={h.o.batch.batch_id} className={sp.b === h.o.batch.batch_id ? "f26-hit" : undefined}>
                  <td className="c">{String(h.o.batch.started_at || "").slice(0, 10)}</td>
                  <td>{h.o.batch.title} <span className="f26-tag">과제 단위</span></td>
                  <td className="c">{String(h.o.batch.target_dept_ids || "").split(",").filter(Boolean).length}</td>
                  <td className="c" title={h.o.codes.join(", ")}>과제 {h.o.n.total.toLocaleString()}</td>
                  <td className="c">{nm.get(h.o.batch.started_by) || h.o.batch.started_by}</td>
                  <td className="c"><span className={`us-st ${h.o.batch.status === "결재완료" ? "ok" : "warn"}`}>{h.o.batch.status}</span></td>
                  <td className="c">
                    <Link className="us-btn-s" href={`/check/${track}/review?role=${role}`}>과제 결재 기록</Link>{" "}
                    <Link className="us-btn-s" href={`/check/${track}/summary?role=${role}&b=${h.o.batch.batch_id}#old`}>결재 기록</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </UsLayout>
  );
}
