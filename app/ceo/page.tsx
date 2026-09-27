// [400 · 교육자료 버전] SCR-026 경영책임자 점검/조치 활동기록 관리 — 기관장 예방활동 › 기관장 활동사항
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import { ceoActivities, activityLog, readTable, depts, staff, type Row } from "@/lib/data";
import { ymd } from "@/lib/day";
import { CeoSide, Modal, fmtAt, ACT_TYPES } from "./_parts";
import { addActivity, removeActivity } from "./actions";

export const dynamic = "force-dynamic";

type Log = { id: string; t: number; atText: string; activity: string; kind: string; detail: [string, string][]; editId?: string };
/** 기관장 예방활동을 적는 역할 — 경영책임자 · 총괄 · 관리자(actions.ts 와 같은 목록). */
const ACT_WRITERS = new Set(["ceo", "gm", "mgr"]);
/** 이 화면에서 넣은 기록(번호 CEOF-)만 수정·삭제 표시한다. */
const isScreenAct = (id: any) => String(id || "").startsWith("CEOF-");
const PER = 10;
/** 「이행률 조회(사업장)」 → 「이행률 조회」 — 상세검색 「활동」 선택지. */
const kindOf = (a: string) => a.replace(/\(.*\)\s*$/, "").trim();

export default async function CeoLog({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const dn = new Map((await depts()).map((d: Row) => [d.dept_id, String(d.dept_name)]));
  const nm = new Map((await staff()).map((s: Row) => [s.staff_id, String(s.display_name || "")]));

  // ① 기관장 예방활동 입력(기존 활동 기록 + 이 화면에서 등록한 것)
  // usf_ceo_activity 와 ceo_activity 를 lib/data 가 함께 읽는다(중복 없이) · 삭제 표시(deleted=Y)한 기록은 뺀다
  const acts = (await ceoActivities()).filter((a: Row) => a.deleted !== "Y");
  const rows: Log[] = acts.map((a) => {
    const at = a.created_at || a.activity_date;
    return {
      id: `A:${a.activity_id}`, t: +new Date(a.created_at || `${a.activity_date}T09:00:00+09:00`),
      atText: a.created_at ? fmtAt(a.created_at) : String(a.activity_date || ""),
      activity: `기관장 예방활동 입력(${a.activity_type || "기타"})`, kind: "기관장 예방활동 입력",
      detail: [
        ["활동 일자", String(a.activity_date || "")], ["유형", String(a.activity_type || "")], ["내용", String(a.title || "")],
        ["장소", String(a.place || "")], ["관련 부서", dn.get(a.dept_id) || String(a.dept_id || "")],
        ["참석자", String(a.participants || "")], ["지적사항", String(a.finding || "")], ["지시사항", String(a.instruction || "")],
        ["증빙", String(a.evidence_name || "")], ["기록", `${nm.get(a.created_by) || a.created_by || ""}${a.proxy === "Y" ? " (대리 기록)" : ""} · ${fmtAt(at)}`],
        ["수정", a.updated_at ? `${nm.get(a.updated_by) || a.updated_by || ""} · ${fmtAt(a.updated_at)}` : ""],
      ],
      editId: isScreenAct(a.activity_id) ? String(a.activity_id) : undefined,
    };
  });
  // ② 시스템 이용 기록(이행률 조회 · 메시지 발신 · 서한문 발송 …)
  for (const l of await readTable("usf_ceo_log", "log_id")) {
    rows.push({
      id: `L:${l.log_id}`, t: +new Date(l.at), atText: fmtAt(l.at), activity: String(l.activity), kind: kindOf(String(l.activity)),
      detail: [["일시", fmtAt(l.at)], ["활동", String(l.activity)], ["내용", String(l.detail || "")]],
    });
  }
  // ③ 경영책임자 역할로 한 저장·결재(공용 기록) — 위 두 표에 쓴 것은 겹치므로 뺀다
  for (const [i, l] of (await activityLog()).entries()) {
    if (l.by !== "CEO-1" || String(l.target || "").startsWith("usf_ceo_")) continue;
    rows.push({
      id: `G:${i}`, t: +new Date(l.at), atText: fmtAt(l.at), activity: String(l.action), kind: kindOf(String(l.action)),
      detail: [["일시", fmtAt(l.at)], ["활동", String(l.action)], ["대상", String(l.target || "")], ["메모", String(l.note || "")]],
    });
  }
  rows.sort((a, b) => b.t - a.t);

  // 검색 — 글자 · 상세(활동 · 기간)
  const q = (sp.q || "").trim();
  const kind = sp.act || "";
  const per = sp.per || "";
  const now = new Date();
  const back = (m: number) => { const d = new Date(now); d.setMonth(d.getMonth() - m); return ymd(d); };
  const from = per === "1m" ? back(1) : per === "3m" ? back(3) : per === "6m" ? back(6) : per === "y" ? `${now.getFullYear()}-01-01` : sp.from || "";
  const to = per === "custom" || !per ? sp.to || "" : "";
  const list = rows.filter((r) =>
    (!q || `${r.activity} ${r.detail.map((d) => d[1]).join(" ")}`.includes(q)) &&
    (!kind || r.kind === kind) &&
    (!from || r.atText.slice(0, 10) >= from) && (!to || r.atText.slice(0, 10) <= to));
  const kinds = [...new Set(rows.map((r) => r.kind))];
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const page = Math.min(pages, Math.max(1, Number(sp.p) || 1));
  const shown = list.slice((page - 1) * PER, page * PER);

  const keep = new URLSearchParams({ role, ...(q ? { q } : {}), ...(kind ? { act: kind } : {}), ...(per ? { per } : {}), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) });
  const url = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams(keep);
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return `/ceo?${p.toString()}`;
  };
  const view = sp.modal === "view" ? rows.find((r) => r.id === sp.id) : undefined;
  const canAdd = ACT_WRITERS.has(role);
  const editing = canAdd && sp.modal === "edit" ? acts.find((a: Row) => a.activity_id === sp.id && isScreenAct(a.activity_id)) : undefined;

  return (
    <UsLayout side={<CeoSide on="log" role={role} />}>
      <div className="usf-logtop">
        <h1 className="usf-logtitle">경영책임자 <b>활동기록</b></h1>
        <form className="usf-srch" method="get">
          <input type="hidden" name="role" value={role} />
          <input type="text" name="q" defaultValue={q} placeholder="검색" aria-label="검색" />
          <button className="usf-ic us-search-btn" type="submit">검색</button>
          <details open={Boolean(kind || per || sp.from || sp.to)}>
            <summary>상세 ▲</summary>
            <div className="usf-pop">
              <label htmlFor="usf-act">활동</label>
              <select id="usf-act" name="act" defaultValue={kind}>
                <option value="">전체</option>
                {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <label htmlFor="usf-per">기간</label>
              <div className="usf-range">
                <select id="usf-per" name="per" defaultValue={per}>
                  <option value="">전체</option>
                  <option value="1m">최근 1개월</option>
                  <option value="3m">최근 3개월</option>
                  <option value="6m">최근 6개월</option>
                  <option value="y">올해</option>
                  <option value="custom">직접 입력</option>
                </select>
                <input type="date" name="from" defaultValue={sp.from || ""} aria-label="시작일" /> - <input type="date" name="to" defaultValue={sp.to || ""} aria-label="종료일" />
              </div>
              <button className="us-btn us-search-btn" type="submit">검색</button>
            </div>
          </details>
        </form>
      </div>
      {sp.saved && <p className="usf-ok">{sp.saved === "2" ? "기관장 예방활동을 고쳤습니다." : "기관장 예방활동을 등록했습니다."}</p>}
      {sp.removed && <p className="usf-ok">기관장 예방활동을 목록에서 뺐습니다(삭제 표시 — 기록은 남습니다).</p>}
      {sp.err === "locked" && <p className="usf-err">처음부터 있던 기록은 고칠 수 없습니다. 이 화면에서 넣은 기록만 수정·삭제합니다.</p>}
      <div className="us-flex" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="us-muted">전체 {list.length.toLocaleString()}건</span>
        {canAdd && <Link className="us-btn g" href={url({ modal: "new" })}>기관장 예방활동 입력</Link>}
      </div>

      <table className="us-tbl usf-log">
        <thead><tr><th style={{ width: "28%" }}>최초 접속일시 기록</th><th>활동</th><th style={{ width: "33%" }} /></tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              <td className="usf-at">{r.atText}</td>
              <td>{r.activity}</td>
              <td><span className="usf-look"><Link className="us-btn-s" href={url({ p: String(page), modal: "view", id: r.id })}>내용보기</Link></span></td>
            </tr>
          ))}
          {!shown.length && <tr><td colSpan={3}>찾는 활동기록이 없습니다.</td></tr>}
        </tbody>
      </table>
      <div className="usf-pager">
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <Link key={n} href={url({ p: String(n) })} className={n === page ? "on" : ""}>{n}</Link>
        ))}
      </div>

      {view && (
        <Modal title="활동 내용" close={url({ p: String(page) })}>
          <dl className="usf-kv">
            {view.detail.filter(([, v]) => v).flatMap(([k, v]) => [<dt key={`k${k}`}>{k}</dt>, <dd key={`v${k}`}>{v}</dd>])}
          </dl>
          {canAdd && view.editId && (
            <div className="usf-save">
              <form action={removeActivity}>
                <input type="hidden" name="role" value={role} />
                <input type="hidden" name="activity_id" value={view.editId} />
                <button className="us-btn w" type="submit" title="목록에서 뺍니다(기록은 남습니다)">삭제</button>
              </form>
              <Link className="us-btn g" href={url({ modal: "edit", id: view.editId })}>수정</Link>
            </div>
          )}
        </Modal>
      )}

      {((sp.modal === "new" && canAdd) || editing) && (
        <Modal title={editing ? "기관장 예방활동 수정" : "기관장 예방활동 입력"} close={url()}>
          {sp.err === "1" && <p className="usf-err">내용을 적어 주십시오.</p>}
          <form action={addActivity} className="usf-form">
            <input type="hidden" name="role" value={role} />
            {editing && <input type="hidden" name="activity_id" value={editing.activity_id} />}
            <table className="us-tbl">
              <tbody>
                <tr><th>활동 일자</th><td><input type="date" name="activity_date" defaultValue={editing ? String(editing.activity_date || "") : ymd()} /></td></tr>
                <tr><th>유형</th><td><select name="activity_type" defaultValue={editing ? String(editing.activity_type || "기타") : "현장점검"}>{ACT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></td></tr>
                <tr><th>내용</th><td><input type="text" name="title" defaultValue={editing ? String(editing.title || "") : ""} placeholder="예) 관내 교량 안전점검 현장 확인" required /></td></tr>
                <tr><th>장소</th><td><input type="text" name="place" defaultValue={editing ? String(editing.place || "") : ""} /></td></tr>
                <tr><th>관련 부서</th><td><select name="dept_id" defaultValue={editing ? String(editing.dept_id || "") : ""}>
                  <option value="">선택</option>
                  {[...dn.entries()].filter(([k]) => k !== "D99").map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select></td></tr>
                <tr><th>참석자</th><td><input type="text" name="participants" defaultValue={editing ? String(editing.participants || "") : ""} /></td></tr>
                <tr><th>지적사항</th><td><textarea name="finding" rows={2} defaultValue={editing ? String(editing.finding || "") : ""} /></td></tr>
                <tr><th>지시사항</th><td><textarea name="instruction" rows={2} defaultValue={editing ? String(editing.instruction || "") : ""} /></td></tr>
                <tr><th>증빙 이름</th><td><input type="text" name="evidence_name" placeholder={editing && editing.evidence_name ? `지금: ${editing.evidence_name} (비워 두면 그대로)` : "예) 현장점검 사진 3매"} /></td></tr>
                <tr><th>사진·증빙<br /><small>※개당 10MB 이하</small></th><td><input type="file" name="evidence_file" /></td></tr>
              </tbody>
            </table>
            {role !== "ceo" && <p className="us-muted">총괄·관리자 담당이 대신 적으면 「대리 기록」으로 남습니다.</p>}
            <div className="usf-save"><Link className="us-btn w" href={url()}>취소</Link><button className="us-btn g" type="submit">{editing ? "수정 저장" : "저장"}</button></div>
          </form>
        </Modal>
      )}
    </UsLayout>
  );
}
