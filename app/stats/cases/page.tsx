// [400 · 교육자료 버전] SCR-097 · SCR-098 · SCR-099 · SCR-100 · SCR-101 — 중대재해 사고사례(목록 · 상세 팝업 · 수정 모드 · 수정 확인 · 삭제 확인)
import CardLightbox from "@/components/us/CardLightbox";
import Link from "next/link";
import { UsLayout, PageHead } from "@/components/us/Parts";
import { StatsSide } from "../_parts/Side";
import { ConfirmButton, FileSlots } from "../_parts/Client";
import { caseRows, filesOf, caseCards } from "../_parts/data";
import { staff, depts } from "@/lib/data";
import { ROLE_STAFF } from "@/lib/roles";
import { caseAction } from "./actions";

export const dynamic = "force-dynamic";
const PER = 10;

export default async function CasesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const w = (sp.w || "").trim(), t = (sp.t || "").trim();
  const all = await caseRows();
  const hit = all.filter((r) => (!w || String(r.writer).includes(w)) && (!t || String(r.title).includes(t)));
  const pages = Math.max(1, Math.ceil(hit.length / PER));
  const page = Math.min(pages, Math.max(1, Number(sp.p) || 1));
  const shown = hit.slice((page - 1) * PER, page * PER);

  // 목록 조건 — 상세·수정에서 「목록」으로 돌아올 때 그대로(SCR-101 주석: 기존 리스트 페이지로 돌아감)
  const lq = new URLSearchParams({ role });
  if (w) lq.set("w", w);
  if (t) lq.set("t", t);
  if (page > 1) lq.set("p", String(page));
  const list = lq.toString();

  const mode = sp.mode === "edit" || sp.mode === "new" ? sp.mode : "";
  const cur = sp.id ? all.find((r) => String(r.case_no) === sp.id) : undefined;
  const showModal = mode === "new" || !!cur;

  // 새 글의 작성자 — 지금 역할의 직원 이름·부서
  let meName = "", meDept = "";
  if (mode === "new") {
    const [st, dl] = await Promise.all([staff(), depts()]);
    const me = st.find((s: any) => s.staff_id === ROLE_STAFF[role]);
    const full = String(me?.display_name || "");
    meName = role === "ceo" ? "시장" : full.replace(/\s+\S+$/, "") || full;
    meDept = role === "ceo" ? "용인특례시" : String(dl.find((d: any) => d.dept_id === me?.dept_id)?.dept_name || "");
  }
  const editing = mode === "edit" || mode === "new";
  const files = cur ? filesOf(cur.files) : [];
  // 본문의 「주요 사고 유형」을 카드뉴스로 붙인다(본문 글 그대로 · 누르면 크게)
  const cards = cur ? caseCards(cur.content) : [];

  return (
    <UsLayout side={<StatsSide role={role} on="cases" />}>
      <PageHead sub="정보센터" title="중대재해 사고사례" />
      {sp.ok && !showModal && <div className="usg-ok">{sp.ok}</div>}

      <form className="usg-search" method="get">
        <input type="hidden" name="role" value={role} />
        <label>작성자 <input name="w" defaultValue={w} placeholder="검색어를 입력하세요" /></label>
        <label>제목 <input name="t" defaultValue={t} placeholder="검색어를 입력하세요" /></label>
        <button type="submit" className="usg-btn-blue us-search-btn">검색</button>
      </form>

      <div className="usg-listbar">
        <span className="usg-count">총 <b>{hit.length}</b>건</span>
        <Link className="usg-btn-o" href={`/stats/cases?${list}&mode=new`}>새 글</Link>
      </div>

      <table className="us-tbl usg-board">
        <thead>
          <tr><th style={{ width: "4.5rem" }}>번호</th><th>제목</th><th style={{ width: "15rem" }}>부서</th><th style={{ width: "7rem" }}>작성자</th><th style={{ width: "10.5rem" }}>등록일자</th><th style={{ width: "5.5rem" }}>조회수</th></tr>
        </thead>
        <tbody>
          {shown.length === 0 && <tr><td colSpan={6} className="c usg-empty">검색 결과가 없습니다.</td></tr>}
          {shown.map((r) => {
            const href = `/stats/cases/open?${list}&id=${r.case_no}`;
            return (
              <tr key={r.case_no} className="usg-row">
                <td className="c"><a href={href}>{r.case_no}</a></td>
                <td><a href={href}>{r.title}</a></td>
                <td className="c"><a href={href}>{r.dept_name}</a></td>
                <td className="c"><a href={href}>{r.writer}</a></td>
                <td className="c"><a href={href}>{r.created_at}</a></td>
                <td className="c"><a href={href}>{r.views}</a></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="usg-pager">
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => {
          const q = new URLSearchParams(lq); if (n > 1) q.set("p", String(n)); else q.delete("p");
          return <Link key={n} href={`/stats/cases?${q.toString()}`} className={n === page ? "on" : ""}>{n}</Link>;
        })}
      </div>

      {showModal && (
        <div className="us-modal-bg usg-case-bg">
          <div className="usg-case">
            <div className="usg-case-crumb">정보센터<br /><b>중대재해 사고사례</b></div>
            <Link className="usg-case-x" href={`/stats/cases?${list}`} aria-label="닫기" title="닫기">✕</Link>
            {sp.err && <div className="usg-err">{sp.err}</div>}
            {sp.ok && <div className="usg-ok">{sp.ok}</div>}
            <form id="usg-case-form" action={caseAction}>
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="list" value={list} />
              {cur && <input type="hidden" name="no" value={cur.case_no} />}
              <div className="usg-cf-row">
                <span className="usg-lb">◉ 제목</span>
                {editing
                  ? <input className="usg-in" name="title" defaultValue={cur?.title || ""} placeholder="제목을 입력하세요" />
                  : <span className="usg-in ro">{cur?.title}</span>}
              </div>
              <div className="usg-cf-row two">
                <span className="usg-lb">◉ 작성자</span>
                <span className="usg-in ro gray">{cur ? cur.writer : meName}</span>
                <span className="usg-lb">◉ 등록일자</span>
                <span className="usg-date">{cur ? cur.created_at : "저장할 때 기록"}</span>
              </div>
              {mode === "new" && <div className="usg-cf-row"><span className="usg-lb">◉ 부서</span><span className="usg-in ro gray">{meDept}</span></div>}
              <div className="usg-cf-row top">
                <span className="usg-lb">◉ 내용</span>
                {editing
                  ? <textarea className="usg-body" name="content" defaultValue={cur?.content || ""} rows={12} />
                  : <div className="usg-body ro">{cur?.content}</div>}
              </div>
              <div className="usg-cf-row top">
                <span className="usg-lb">◉ 첨부파일</span>
                <div className="usg-files">
                  {cards.length > 0 && (
                    // 09-26 사용자: 첨부를 열면 돌아갈 길이 없다 → 같은 화면 위에 띄우고 닫기(components/us/CardLightbox)
                    <CardLightbox items={cards.map((c) => ({
                      src: `/stats/cases/card?no=${cur!.case_no}&i=${c.no}`,
                      name: `카드뉴스_${c.no}_${c.sector}.svg`, alt: `카드뉴스 ${c.no} — ${c.what}`,
                    }))} />
                  )}
                  {files.length > 0 && (
                    <ul className="usg-filelist">
                      {files.map((x, i) => <li key={i}><a href={x.url} target="_blank" rel="noopener">📎 {x.name}</a></li>)}
                    </ul>
                  )}
                  {editing && <FileSlots n={5} />}
                </div>
              </div>
            </form>
            <div className="usg-case-btns">
              {mode === "new" && <ConfirmButton label="등록" message="게시물을 등록하시겠습니까?" className="usg-b blue" formId="usg-case-form" name="op" value="save" />}
              {mode === "edit" && <ConfirmButton label="수정 완료" message="게시물을 수정하시겠습니까?" className="usg-b blue" formId="usg-case-form" name="op" value="save" />}
              {!editing && cur && <Link className="usg-b blue" href={`/stats/cases?${list}&id=${cur.case_no}&mode=edit`}>수정</Link>}
              {cur && <ConfirmButton label="삭제" message="게시물을 삭제하시겠습니까?" className="usg-b red" formId="usg-case-form" name="op" value="delete" />}
              <Link className="usg-b" href={`/stats/cases?${list}`}>목록</Link>
            </div>
          </div>
        </div>
      )}
    </UsLayout>
  );
}
