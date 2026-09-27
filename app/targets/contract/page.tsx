// [400 · 교육자료 버전] SCR-030 관리대상 현황 › 사업 — 도급·용역·위탁 현황 정보 조회 및 등록·관리
// 명세 이미지 030: 소제목 「사업」 + 제목 → 회색 검색 패널(담당계약 · 계약명 · 🔍 검색) → 총 N건 + 「도급·용역·위탁 등록하기」 → 표.
// 표 컬럼 원문: 실·국·본부 / 부서명 / 시설물명 / 계약명 / 담당자. 행을 누르면 SCR-031~033 상세(한 화면)로 간다.
import Link from "next/link";
import { UsLayout, PageHead } from "@/components/us/Parts";
import { assetSeed } from "@/lib/data";
import { B1Side } from "../_side";
import { contractList, deptNames, staffMap, workplace } from "../_lib";

export const dynamic = "force-dynamic";
const PAGE = 20;

export default async function ContractList({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const q = (sp.q || "").trim();
  const dn = await deptNames();
  const { nameOnly } = await staffMap();
  const wp = await workplace();
  const aName = new Map(assetSeed().map((a) => [a.asset_id, a.asset_name]));

  let rows = await contractList(role);
  if (q) rows = rows.filter((c) => String(c.contract_name || "").includes(q));
  rows.sort((a, b) => String(a.contract_id).localeCompare(String(b.contract_id)));
  const pg = Math.max(1, Number(sp.p || 1));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice((pg - 1) * PAGE, pg * PAGE);
  const go = (p: number) => `/targets/contract?role=${role}${q ? `&q=${encodeURIComponent(q)}` : ""}&p=${p}`;

  return (
    <UsLayout side={<B1Side role={role} on="contract" />}>
      <PageHead sub="사업" title="도급·용역·위탁 현황" />

      <form className="usb1-cs" action="/targets/contract">
        <input type="hidden" name="role" value={role} />
        <div className="usb1-cs-l">담당계약</div>
        <div className="usb1-cs-b">
          <label>계약명</label>
          <input type="text" name="q" defaultValue={q} placeholder="계약명을 입력하세요" />
          <button type="submit" className="usb1-btn-o us-search-btn">검색</button>
        </div>
      </form>

      <div className="usb1-cnt">
        <span>총 <b className="usb1-blue-n">{rows.length}</b>건</span>
        <span className="d26-btns">
          {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 옛 「도급·용역·위탁 중점 관리」(/contracts)로 가는 길 */}
          <Link className="usb1-btn-o" href={`/contracts?role=${role}`}>수급인 평가 · 도급 단계 현황</Link>
          <Link className="usb1-btn-g" href={`/targets/contract/new?role=${role}`}>도급·용역·위탁 등록하기</Link>
        </span>
      </div>
      <table className="us-tbl usb1-list">
        <thead><tr><th>실·국·본부</th><th>부서명</th><th>시설물명</th><th>계약명</th><th>담당자</th></tr></thead>
        <tbody>
          {view.map((c) => {
            const href = `/targets/contract/${encodeURIComponent(c.contract_id)}?role=${role}`;
            return (
              <tr key={c.contract_id}>
                {/* TODO: 확인 — 실·국 조직 자료가 없어 사업장명(용인시청 본청)을 적는다 */}
                <td className="c">{wp.wp_name}</td>
                <td className="c">{dn.get(c.dept_id) || c.order_dept || "-"}</td>
                <td className="c">{c.asset_id ? aName.get(c.asset_id) || c.asset_id : "해당없음"}</td>
                <td><Link href={href}>{c.contract_name}</Link></td>
                <td className="c">{c.manager_name || nameOnly(c.manager_staff_id) || "-"}</td>
              </tr>
            );
          })}
          {!view.length && <tr><td className="c" colSpan={5}>등록된 도급·용역·위탁 정보가 없습니다.</td></tr>}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="usb1-pager">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={go(n)} className={n === pg ? "on" : ""}>{n}</Link>
          ))}
        </div>
      )}
    </UsLayout>
  );
}
