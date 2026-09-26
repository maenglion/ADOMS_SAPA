// 09-26 사용자: 메뉴 밖 화면 합치기 — 옛 「설정」(/settings)의 법정 서식 목록을 관리자 › 서식 › 법정 서식으로 옮겼다.
//  목록만 보여 준다(서식 파일을 더하거나 고치는 화면이 아니다). 서식 하나를 누르면 서식 보기(/forms/…)가 열리고
//  「← 돌아가기」가 이 목록(검색 조건 그대로)으로 돌아온다. 권한은 lib/perm.ts 의 /admin 규칙(총괄·관리자)을 그대로 따른다.
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import { forms, duties } from "@/lib/data";
import { formIndex } from "@/lib/forms";
import { idKo } from "@/lib/labels";
import AdminSide from "../_side";
import { Count, Pager, SearchBox, qs } from "../_ui";

export const dynamic = "force-dynamic";
const PAGE = 20;

export default async function AdminForms({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const q = (sp.q || "").trim();
  const k = sp.k === "table" || sp.k === "form" ? sp.k : "";   // "" 전체 · table 별표 · form 별지서식
  const [f, du] = await Promise.all([forms(), duties({ limit: 100000 })]);
  // 근거 문서는 식별자 대신 문서 이름으로(옛 설정 화면과 같은 방법)
  const docName = new Map<string, string>(du.map((r: any) => [r.doc_id, r.doc || r.law]));
  const quality = new Map(formIndex().map((m) => [m.id, m.quality]));

  const all = [...f].sort((a: any, b: any) =>
    String(docName.get(a.doc_id) || "").localeCompare(String(docName.get(b.doc_id) || ""), "ko")
    || String(a.schedule_kind).localeCompare(String(b.schedule_kind))
    || Number(a.schedule_no || 0) - Number(b.schedule_no || 0));
  let rows = all;
  if (k) rows = rows.filter((x: any) => (k === "table" ? x.schedule_kind === "table" : x.schedule_kind !== "table"));
  if (q) rows = rows.filter((x: any) => String(x.title || "").includes(q) || String(docName.get(x.doc_id) || "").includes(q));
  const nTable = all.filter((x: any) => x.schedule_kind === "table").length;

  const keep = { role, q, k };
  const pg = Math.max(1, Number(sp.p || 1));
  const view = rows.slice((pg - 1) * PAGE, pg * PAGE);
  const back = qs("/admin/forms", { ...keep, p: pg > 1 ? pg : undefined });

  return (
    <UsLayout side={<AdminSide page="forms" />}>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">서식</span> 법정 서식</h1>
      </div>
      <p className="admf-lead">
        관계 법령의 별표와 별지 서식입니다. 서식을 누르면 표로 정리한 서식이 열리고, 그 화면에서 인쇄하거나 PDF로 내려받을 수 있습니다.
      </p>

      <SearchBox>
        <form method="get" action="/admin/forms" className="usb2-sform">
          <input type="hidden" name="role" value={role} />
          <label>종류
            <select name="k" defaultValue={k}>
              <option value="">전체</option>
              <option value="table">별표 ({nTable})</option>
              <option value="form">별지 서식 ({all.length - nTable})</option>
            </select>
          </label>
          <label>서식명 · 법령<input type="text" name="q" defaultValue={q} placeholder="서식 이름이나 법령 이름을 입력하세요" /></label>
          <button className="usb2-ibtn" type="submit" title="검색">🔍</button>
        </form>
      </SearchBox>

      <Count n={rows.length} unit="건" />
      <table className="us-tbl usb2-tl">
        <thead><tr><th style={{ width: "9rem" }}>번호</th><th>서식명</th><th style={{ width: "10rem" }}>종류</th><th>근거 법령</th><th style={{ width: "9rem" }}>보기 형태</th></tr></thead>
        <tbody>
          {view.map((x: any) => (
            <tr key={x.form_id}>
              <td className="c">{idKo(x.form_id)}</td>
              <td><Link href={`/forms/${x.form_id}?back=${encodeURIComponent(back)}`}>{x.title}</Link></td>
              <td className="c">{x.schedule_kind === "table" ? `별표 ${x.schedule_no}` : `별지 제${x.schedule_no}호서식`}</td>
              <td>{docName.get(x.doc_id) || "-"}</td>
              <td className="c">{quality.get(x.form_id) === "good" ? "표로 정리됨" : quality.has(x.form_id) ? "원문 그대로" : "-"}</td>
            </tr>
          ))}
          {!view.length && <tr><td colSpan={5} className="c usb2-empty">조회된 서식이 없습니다</td></tr>}
        </tbody>
      </table>
      <Pager total={rows.length} size={PAGE} page={pg} href={(p) => qs("/admin/forms", { ...keep, p })} />
    </UsLayout>
  );
}
