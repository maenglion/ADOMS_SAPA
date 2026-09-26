// [400 · 교육자료 버전] SCR-095 · SCR-096 — 중대재해 대상통계(3개 패널 · 차트 다운로드 팝업)
import { UsLayout, PageHead } from "@/components/us/Parts";
import { StatsSide } from "../_parts/Side";
import ChartCard from "../_parts/ChartCard";
import { AutoForm } from "../_parts/Client";
import { countBy } from "../_parts/data";
import { depts, assetSeed, assetMapSeed, contracts, duties, readTable, type Row } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * 모수(관리대상)는 우리 자료에서 센다.
 *  · 사업장 — 용인시청 본청 1개소(사용자 지시 09-24) · 부서 = 직제(depts) · 업종 분류 명 = usg_ws_industry
 *  · 공중이용시설·공중교통수단 — 관리대상 대장(assets). 중대재해처벌법 「제외」 판정 자산은 세지 않는다.
 *      관리형태는 도급·용역·위탁 계약(contracts)에서 계산: 민간위탁 계약 → 민간위탁 · 용역 계약 → 대행 · 그 밖 → 직접관리
 *  · 원료·제조물 — 원료·제조물 대장(material_item)
 */
const WS_AX = ["업종 분류 명", "부서 역할"];
const FC_AX = ["관리형태", "시설구분", "시설종류", "시설물 종별", "안전등급", "중대재해처벌법 판정", "관리대상 유형"];
const MT_AX = ["관리형태", "취급 행위", "판정"];
const ACTS: Record<string, string> = { produce: "생산·제조", provide: "판매·유통·제공", enduse: "최종 사용" };

export default async function TargetStats({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const wa = WS_AX.includes(sp.wa) ? sp.wa : WS_AX[0];
  const fa = FC_AX.includes(sp.fa) ? sp.fa : FC_AX[0];
  const ma = MT_AX.includes(sp.ma) ? sp.ma : MT_AX[0];

  const [dl, ind, ctr, dt, mats] = await Promise.all([
    depts(), readTable("usg_ws_industry", "dept_id"), contracts(), duties({ limit: 20000 }), readTable("material_item", "item_id"),
  ]);
  const deptName = new Map(dl.map((d: Row) => [d.dept_id, d.dept_name]));

  /* ── [1열] 사업장 ── */
  const indBy = new Map(ind.map((r) => [r.dept_id, r]));
  const wsDepts = dl.filter((d: Row) => d.dept_id !== "D99" && indBy.has(d.dept_id))
    .filter((d: Row) => !sp.wn || indBy.get(d.dept_id)?.workplace === sp.wn);
  const workplaces = [...new Set(ind.map((r) => r.workplace).filter(Boolean))];
  const wsN = new Set(wsDepts.map((d: Row) => indBy.get(d.dept_id)?.workplace)).size;
  const wsPairs = countBy(wsDepts, (d) => (wa === "부서 역할" ? d.dept_role : indBy.get(d.dept_id)?.industry || "미지정"));

  /* ── [2열] 공중이용시설·공중교통수단 ── */
  const ent = new Map<string, string>();
  ctr.forEach((c: Row) => { if (c.asset_id) ent.set(c.asset_id, c.entrust_type === "민간위탁" ? "민간위탁" : c.entrust_type === "용역" ? "대행" : "직접관리"); });
  const liveAssets = assetSeed().filter((a) => a.sapa_l2_result !== "제외");
  const excluded = assetSeed().length - liveAssets.length;
  const fcAssets = liveAssets.filter((a) => !sp.fd || a.dept_id === sp.fd);
  const fcDeptIds = [...new Set(liveAssets.map((a) => a.dept_id).filter(Boolean))].sort();
  const tName = new Map<string, string>();
  dt.forEach((d: Row) => d.target_code && tName.set(d.target_code, d.target_name));
  let fcPairs: [string, number][];
  if (fa === "관리대상 유형") {
    const ids = new Set(fcAssets.map((a) => a.asset_id));
    fcPairs = countBy(assetMapSeed().filter((m) => ids.has(m.asset_id)), (m) => tName.get(m.target_code) || m.target_code);
  } else {
    const key: Record<string, (a: Row) => string> = {
      관리형태: (a) => ent.get(a.asset_id) || "직접관리",
      시설구분: (a) => a.asset_gbn || "기타",
      시설종류: (a) => a.asset_kind || "기타",
      "시설물 종별": (a) => a.asset_class || "미지정",
      안전등급: (a) => a.safety_grade || "불명",
      "중대재해처벌법 판정": (a) => a.sapa_l2_result || "미판정",
    };
    fcPairs = countBy(fcAssets, key[fa]);
  }

  /* ── [3열] 원료·제조물 ── */
  const matLive = mats.filter((m) => m.deleted !== "Y");
  const mtItems = matLive.filter((m) => !sp.md || m.dept_id === sp.md);
  const mtDeptIds = [...new Set(matLive.map((m) => m.dept_id).filter(Boolean))].sort();
  const actsOf = (m: Row) => String(m.acts || "").split(/[;,·\s]+/).filter(Boolean);
  let mtPairs: [string, number][];
  if (ma === "취급 행위") {
    const m = new Map<string, number>();
    mtItems.forEach((it) => { const a = actsOf(it); (a.length ? a.map((x) => ACTS[x] || x) : ["확인 전"]).forEach((k) => m.set(k, (m.get(k) || 0) + 1)); });
    mtPairs = [...m.entries()].sort((a, b) => b[1] - a[1]);
  } else if (ma === "판정") {
    mtPairs = countBy(mtItems, (m) => m.verdict || "미판정");
  } else {
    // 관리형태 — 비해당 판정은 「해당없음」, 그 밖은 소관 부서가 직접 다룬다(「시 직접관리」)
    mtPairs = countBy(mtItems, (m) => (m.verdict === "비해당" ? "해당없음" : "시 직접관리"));
  }

  // 다른 패널의 선택을 잃지 않도록 숨은 칸으로 넘긴다(열 간 독립 · 명세)
  const keep = (skip: string[]) => ["wn", "wa", "fd", "fa", "md", "ma"].filter((k) => !skip.includes(k) && sp[k])
    .map((k) => <input key={k} type="hidden" name={k} value={sp[k]} />);

  return (
    <UsLayout side={<StatsSide role={role} on="target" />}>
      <PageHead sub="통계" title="중대재해 대상통계" />
      <div className="usg-tri">
        <section>
          <AutoForm className="usg-tcard">
            <input type="hidden" name="role" value={role} />{keep(["wn", "wa"])}
            <label><span>사업장명</span>
              <select name="wn" defaultValue={sp.wn || ""}><option value="">전체보기</option>{workplaces.map((w) => <option key={w}>{w}</option>)}</select>
            </label>
            <label><span>검색조건</span>
              <select name="wa" defaultValue={wa} className="sel">{WS_AX.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <div className="usg-tsum"><span>사업장({wsN}개소)</span><b>{wsDepts.length}<small>부서</small></b></div>
          </AutoForm>
          <ChartCard title={`사업장 — ${wa}`} labels={wsPairs.map((x) => x[0])} values={wsPairs.map((x) => x[1])} unit="부서" variant="plain" toolsLeft rotate width={340} height={330} />
        </section>

        <section>
          <AutoForm className="usg-tcard">
            <input type="hidden" name="role" value={role} />{keep(["fd", "fa"])}
            <label><span>실.국.본부</span>
              <select name="fd" defaultValue={sp.fd || ""}><option value="">전체보기</option>{fcDeptIds.map((d) => <option key={d} value={d}>{deptName.get(d) || d}</option>)}</select>
            </label>
            <label><span>검색조건</span>
              <select name="fa" defaultValue={fa} className="sel">{FC_AX.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <div className="usg-tsum"><span>공중이용시설·공중교통수단</span><b>{fcAssets.length}<small>개소</small></b></div>
          </AutoForm>
          <ChartCard title={`공중이용시설·공중교통수단 — ${fa}`} labels={fcPairs.map((x) => x[0])} values={fcPairs.map((x) => x[1])} unit="개소" variant="plain" toolsLeft rotate width={340} height={330} />
          <p className="usg-note">※ 중대재해처벌법 「제외」 판정 {excluded}개소는 세지 않습니다.{fa === "관리대상 유형" ? " 한 시설이 여러 관리대상 유형에 걸리면 유형마다 셉니다." : ""}{fa === "관리형태" ? " 관리형태는 도급·용역·위탁 계약에서 계산합니다." : ""}</p>
        </section>

        <section>
          <AutoForm className="usg-tcard">
            <input type="hidden" name="role" value={role} />{keep(["md", "ma"])}
            <label><span>실.국.본부</span>
              <select name="md" defaultValue={sp.md || ""}><option value="">전체보기</option>{mtDeptIds.map((d) => <option key={d} value={d}>{deptName.get(d) || d}</option>)}</select>
            </label>
            <label><span>검색조건</span>
              <select name="ma" defaultValue={ma} className="sel">{MT_AX.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            {/* 명세는 「개소」 — 원료·제조물은 장소가 아니라 품목이라 「품목」으로 센다 */}
            <div className="usg-tsum"><span>원료·제조물</span><b>{mtItems.length}<small>품목</small></b></div>
          </AutoForm>
          <ChartCard title={`원료·제조물 — ${ma}`} labels={mtPairs.map((x) => x[0])} values={mtPairs.map((x) => x[1])} unit="품목" variant="plain" toolsLeft rotate width={340} height={330} />
        </section>
      </div>
    </UsLayout>
  );
}
