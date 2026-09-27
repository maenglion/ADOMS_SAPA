/**
 * [400 · 교육자료 버전] 묶음 F — 게시판(공지사항 · 자료실) 공용 화면 조각. 참고 명세에 화면이 없어(명세 00 §11 #11)
 * 교육자료 톤(연녹색 좌측 메뉴 · 회색 머리 표)으로 목록 · 상세 · 등록 세 화면을 한 틀로 만든다.
 * 표: usf_notice(공지사항) · usf_file(자료실). 쓰기는 ./actions.ts.
 */
import Link from "next/link";
import AdminSide from "@/app/admin/_side";
import { UsLayout, EvHead } from "@/components/us/Parts";
import { readTable, staff, type Row } from "@/lib/data";
import { ymd } from "@/lib/day";
import { saveBoard } from "./actions";

export type Kind = "notice" | "files";
export const BOARD: Record<Kind, { table: string; key: string; title: string; prefix: string; sub: string }> = {
  notice: { table: "usf_notice", key: "notice_id", title: "공지사항", prefix: "NTC", sub: "이행점검 일정·시스템 이용·안전 당부 등 알림" },
  files: { table: "usf_file", key: "file_id", title: "자료실", prefix: "FIL", sub: "서식·지침·교육자료 내려받기" },
};
export const CATS = ["서식", "지침·매뉴얼", "교육자료", "법령 해설", "기타"];
const PER = 10;

/** 공지 등록은 총괄·관리자·경영책임자, 자료 등록은 누구나. */
export const canWrite = (k: Kind, role: string) => k === "files" || ["ceo", "gm", "mgr"].includes(role);

export function fmtDay(v: any) {
  const s = String(v || "");
  const d = new Date(s);
  return isNaN(+d) ? s.slice(0, 10) : ymd(d);
}

/** 파일 내려받기 주소 — 올린 파일이 있으면 그 주소, 자료실 기본 서식은 만들어 내려 준다. */
export function fileHref(k: Kind, r: Row) {
  if (r.evidence_url) return String(r.evidence_url);
  if (k === "files" && r.gen_content) return `/board/files/dl/${encodeURIComponent(r.file_id)}`;
  return "";
}

// 09-25: 게시판은 머리 메뉴 「관리자」 밑 — 좌측도 관리자 메뉴를 그대로 둔다(누르면 오른쪽만 바뀜)
export function BoardSide({ kind }: { kind: Kind; role: string }) {
  return <AdminSide page={kind} />;
}

async function rowsOf(k: Kind) {
  const b = BOARD[k];
  return (await readTable(b.table, b.key)).filter((r) => r.deleted !== "Y")
    .sort((a, c) => String(fmtDay(c.created_at)).localeCompare(String(fmtDay(a.created_at))) || String(c.created_at).localeCompare(String(a.created_at)));
}
async function names() {
  return new Map((await staff()).map((s: Row) => [s.staff_id, String(s.display_name || "")]));
}

/* ── 목록 ─────────────────────────────────────────────── */
export async function BoardList({ kind, sp }: { kind: Kind; sp: Record<string, string> }) {
  const role = sp.role || "gm";
  const b = BOARD[kind];
  const nm = await names();
  const all = await rowsOf(kind);
  const q = (sp.q || "").trim();
  const cat = sp.cat || "";
  let list = all.filter((r) => (!q || `${r.title} ${r.body}`.includes(q)) && (!cat || r.category === cat));
  if (kind === "notice") list = [...list.filter((r) => r.pinned === "Y"), ...list.filter((r) => r.pinned !== "Y")];
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const page = Math.min(pages, Math.max(1, Number(sp.p) || 1));
  const shown = list.slice((page - 1) * PER, page * PER);
  const qs = (p: number) => `/board/${kind}?${new URLSearchParams({ role, ...(q ? { q } : {}), ...(cat ? { cat } : {}), p: String(p) })}`;

  return (
    <UsLayout side={<BoardSide kind={kind} role={role} />}>
      <div className="usf-top">
        <div><h1 className="us-h1">{b.title}</h1><div className="usf-sub">{b.sub}</div></div>
        {canWrite(kind, role) && <div className="usf-top-r"><Link className="us-btn g" href={`/board/${kind}/new?role=${role}`}>글쓰기</Link></div>}
      </div>
      {sp.saved && <p className="usf-ok">등록했습니다.</p>}
      <form className="us-filter" method="get">
        <input type="hidden" name="role" value={role} />
        {kind === "files" && (
          <label>구분
            <select name="cat" defaultValue={cat}><option value="">전체</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
        )}
        <label>검색어 <input type="text" name="q" defaultValue={q} placeholder="제목 또는 내용" /></label>
        <button className="us-btn us-search-btn" type="submit">검색</button>
        <span className="us-muted">전체 {list.length}건</span>
      </form>
      <table className="us-tbl">
        <thead>
          <tr>
            <th style={{ width: 70 }}>번호</th>
            {kind === "files" && <th style={{ width: 130 }}>구분</th>}
            <th>제목</th>
            {kind === "files" && <th style={{ width: "24%" }}>파일</th>}
            <th style={{ width: 150 }}>작성자</th><th style={{ width: 120 }}>등록일</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => {
            const href = fileHref(kind, r);
            return (
              <tr key={r[b.key]} className={r.pinned === "Y" ? "hl" : ""}>
                <td className="c">{r.pinned === "Y" ? <span className="usf-pin">공지</span> : list.length - ((page - 1) * PER + i)}</td>
                {kind === "files" && <td className="c">{r.category}</td>}
                <td className="usf-title"><Link href={`/board/${kind}/${encodeURIComponent(r[b.key])}?role=${role}`}>{r.title}</Link>{kind === "notice" && r.evidence_name ? " 📎" : ""}</td>
                {kind === "files" && <td>{href ? <a href={href}>{r.evidence_name || "다운로드"}</a> : r.evidence_name || "-"}</td>}
                <td className="c">{nm.get(r.written_by) || r.written_by}</td>
                <td className="c">{fmtDay(r.created_at)}</td>
              </tr>
            );
          })}
          {!shown.length && <tr><td colSpan={kind === "files" ? 6 : 4} className="c">글이 없습니다.</td></tr>}
        </tbody>
      </table>
      <div className="usf-pager">
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Link key={n} href={qs(n)} className={n === page ? "on" : ""}>{n}</Link>)}
      </div>
    </UsLayout>
  );
}

/* ── 상세 ─────────────────────────────────────────────── */
export async function BoardView({ kind, id, sp }: { kind: Kind; id: string; sp: Record<string, string> }) {
  const role = sp.role || "gm";
  const b = BOARD[kind];
  const all = await rowsOf(kind);
  const i = all.findIndex((r) => r[b.key] === id);
  const r = all[i];
  const nm = await names();
  const back = `/board/${kind}?role=${role}`;
  if (!r) {
    return (
      <UsLayout side={<BoardSide kind={kind} role={role} />}>
        <div className="us-card w">없는 글입니다. <Link href={back}>목록으로 →</Link></div>
      </UsLayout>
    );
  }
  const href = fileHref(kind, r);
  const prev = all[i + 1], next = all[i - 1];
  return (
    <UsLayout side={<BoardSide kind={kind} role={role} />}>
      <div className="usf-top"><div><h1 className="us-h1">{b.title}</h1><div className="usf-sub">{b.sub}</div></div></div>
      <div className="usf-view-h">
        <h2>{r.pinned === "Y" && <span className="usf-pin">공지</span>}{kind === "files" && r.category ? `[${r.category}] ` : ""}{r.title}</h2>
        <span className="us-muted">작성자 {nm.get(r.written_by) || r.written_by} · 등록일 {fmtDay(r.created_at)}</span>
      </div>
      <div className="usf-view-body">{r.body}</div>
      <div className="usf-view-files">
        <b>첨부파일</b>
        {r.evidence_name ? (href ? <a className="us-btn-s" href={href}>다운로드: {r.evidence_name}</a> : <span>{r.evidence_name}</span>) : <span className="us-muted">없음</span>}
      </div>
      <table className="us-tbl" style={{ marginTop: 14 }}>
        <tbody>
          <tr><th style={{ width: 120 }}>이전 글</th><td>{prev ? <Link href={`/board/${kind}/${encodeURIComponent(prev[b.key])}?role=${role}`}>{prev.title}</Link> : "이전 글이 없습니다."}</td></tr>
          <tr><th>다음 글</th><td>{next ? <Link href={`/board/${kind}/${encodeURIComponent(next[b.key])}?role=${role}`}>{next.title}</Link> : "다음 글이 없습니다."}</td></tr>
        </tbody>
      </table>
      <div className="usf-actions"><Link className="us-btn w" href={back}>목록으로</Link></div>
    </UsLayout>
  );
}

/* ── 등록 ─────────────────────────────────────────────── */
export function BoardForm({ kind, sp }: { kind: Kind; sp: Record<string, string> }) {
  const role = sp.role || "gm";
  const b = BOARD[kind];
  const back = `/board/${kind}?role=${role}`;
  if (!canWrite(kind, role)) {
    return (
      <UsLayout side={<BoardSide kind={kind} role={role} />}>
        <div className="us-card w">공지사항은 총괄·관리 담당만 등록합니다. <Link href={back}>목록으로 →</Link></div>
      </UsLayout>
    );
  }
  return (
    <UsLayout side={<BoardSide kind={kind} role={role} />}>
      <div className="usf-top"><div><h1 className="us-h1">{b.title} 글쓰기</h1><div className="usf-sub">{b.sub}</div></div></div>
      {sp.err && <p className="usf-err">제목과 내용을 적어 주십시오.</p>}
      <form action={saveBoard} className="usf-form">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="kind" value={kind} />
        <table className="us-tbl">
          <tbody>
            {kind === "files" && (
              <tr><th>구분</th><td><select name="category" defaultValue="서식">{CATS.map((c) => <option key={c}>{c}</option>)}</select></td></tr>
            )}
            <tr><th>제목</th><td><input type="text" name="title" required /></td></tr>
            {kind === "notice" && (
              <tr><th>상단 고정</th><td><label className="usf-checks"><span><input type="checkbox" name="pinned" value="Y" /> 목록 맨 위에 「공지」로 둡니다</span></label></td></tr>
            )}
            <tr><th>내용</th><td><textarea name="body" rows={12} required /></td></tr>
            <tr><th>{kind === "files" ? "파일" : <EvHead />}</th><td><input type="file" name="evidence_file" /></td></tr>
          </tbody>
        </table>
        <div className="usf-actions"><Link className="us-btn w" href={back}>취소</Link><button className="us-btn g" type="submit">등록</button></div>
      </form>
    </UsLayout>
  );
}
