// [400 · 교육자료 버전] SCR-091 · SCR-092 · SCR-093 · SCR-094 — 중대재해 발생통계(목록·표 · 표 슬라이더 · 차트 대시보드 · 차트 다운로드 팝업)
import Link from "next/link";
import { UsLayout, PageHead } from "@/components/us/Parts";
import { StatsSide } from "../_parts/Side";
import ChartCard from "../_parts/ChartCard";
import { AutoForm } from "../_parts/Client";
import { OCC_COLS, OCC_BASE_DATE, occurRows, filterOcc, uniq, countBy, shareOf } from "../_parts/data";
import { uploadOccur } from "./actions";
import OccTables from "../_parts/OccTables";

// 위 = 발생 목록(연도별~근로형태 + 재해유형 · 상해종류) · 아래 = 선택한 사고 한 건의 사고 내용(생년~비고) — 09-25 사용자
const SPLIT = OCC_COLS.findIndex((c) => c.key === "birth_year");
const TOP = [...OCC_COLS.slice(0, SPLIT), ...OCC_COLS.filter((c) => c.key === "acc_type" || c.key === "injury")];
const BOTTOM = OCC_COLS.slice(SPLIT);

export const dynamic = "force-dynamic";

const AGES = ["20대", "30대", "40대", "50대", "60대", "70대"];
const QS = ["1분기", "2분기", "3분기", "4분기"];

export default async function OccurPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const view = sp.view === "chart" ? "chart" : "table";
  const base = /^\d{4}-\d{2}-\d{2}$/.test(sp.base || "") ? sp.base : OCC_BASE_DATE;
  const all = await occurRows();
  const upToBase = filterOcc(all, { base });
  const rows = filterOcc(all, { y: sp.y, org: sp.org, dept: sp.dept, acc: sp.acc, inj: sp.inj, base });

  // 거르기 값 — 원장에서 나오는 값만
  const years = uniq(all, "year").sort((a, b) => b.localeCompare(a));
  const orgs = uniq(all, "org_name");
  const deptsL = uniq(sp.org ? all.filter((r) => r.org_name === sp.org) : all, "dept_name");
  const accs = uniq(all, "acc_type");
  const injs = uniq(all, "injury");

  // 차트 4종(SCR-093) — 위 거르기가 4개 차트에 공통 적용(명세 추정)
  const ageOf = (r: any) => {
    const a = Number(r.year) - Number(r.birth_year);
    if (!a || !Number(r.birth_year)) return "";
    return `${Math.min(70, Math.max(20, Math.floor(a / 10) * 10))}대`;
  };
  const age = countBy(rows, ageOf, AGES);
  const acc = shareOf(countBy(rows, (r) => r.acc_type));
  const qtr = countBy(rows, (r) => (r.occurred_at ? `${Math.floor((Number(String(r.occurred_at).slice(5, 7)) - 1) / 3) + 1}분기` : ""), QS);
  // 명세 원본 차트는 「상해종류」 제목에 재해유형 이름이 들어간 샘플 오류 — 원장 「상해종류」 칸으로 센다(명세 권고)
  const inj = shareOf(countBy(rows, (r) => r.injury));

  const q = new URLSearchParams({ role });
  (["y", "org", "dept", "acc", "inj"] as const).forEach((k) => sp[k] && q.set(k, sp[k]));
  q.set("base", base);
  const back = q.toString();
  const dl = `/stats/export?kind=occur&fmt=xls&${back}`;
  const dot = base.replace(/-/g, ".");

  return (
    <UsLayout side={<StatsSide role={role} on="occur" />}>
      <PageHead sub="통계" title="중대재해 발생 통계" />
      {sp.ok && <div className="usg-ok">{sp.ok}</div>}

      <AutoForm className="usg-fbar-wrap">
        <input type="hidden" name="role" value={role} />
        {view === "chart" && <input type="hidden" name="view" value="chart" />}
        <div className="usg-fbar">
          <div className="usg-frow">
            {/* TODO: 확인 — 연도 필수(*) 표시는 원문 그대로, 기본값은 「전체보기」(명세 원문) */}
            <label>연도 <i className="usg-req">*</i>
              <select name="y" defaultValue={sp.y || ""}><option value="">전체보기</option>{years.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label>기관명
              <select name="org" defaultValue={sp.org || ""}><option value="">전체보기</option>{orgs.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label>실국과
              <select name="dept" defaultValue={sp.dept || ""}><option value="">전체보기</option>{deptsL.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label>재해유형
              <select name="acc" defaultValue={sp.acc || ""}><option value="">전체보기</option>{accs.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label>상해종류
              <select name="inj" defaultValue={sp.inj || ""}><option value="">전체보기</option>{injs.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
          </div>
          <div className="usg-fnote">※ {dot} 기준 총 {upToBase.length}건의 산업재해가 발생</div>
        </div>
        <div className="usg-fright">
          <label className="usg-base">기준일자 <input type="date" name="base" defaultValue={base} /></label>
          <a className="usg-btn-o" href={dl}>다운로드</a>
          <Link className="usg-btn-o" href={`/stats/occur?${back}&modal=upload`}>업로드</Link>
        </div>
      </AutoForm>

      <div className="usg-count">총 <b>{rows.length}</b>건</div>

      {/* 보기 전환 — 표(발생 목록 + 사고 내용) / 그래프(09-24 사용자: 예시처럼 두 표 · 그래프로도) */}
      <div className="usg-vtab">
        <Link href={`/stats/occur?${back}`} className={view !== "chart" ? "on" : ""}>표로 보기</Link>
        <Link href={`/stats/occur?${back}&view=chart`} className={view === "chart" ? "on" : ""}>그래프로 보기</Link>
      </div>

      {view !== "chart" && <OccTables rows={[...rows].reverse()} top={TOP} bottom={BOTTOM} />}   {/* 09-25 사용자: 최근 사고 먼저 */}

      {/* SCR-093 차트 대시보드(2×2) · SCR-094 다운로드 팝업 */}
      {view === "chart" && <div className="usg-dash">
        <ChartCard title="연령대별" labels={age.map((x) => x[0])} values={age.map((x) => x[1])} unit="건" type="bar" rotate={false} />
        <ChartCard title="재해유형" labels={acc.map((x) => x[0])} values={acc.map((x) => x[1])} unit="%" type="pie" />
        <ChartCard title="분기별" labels={qtr.map((x) => x[0])} values={qtr.map((x) => x[1])} unit="건" type="line" rotate={false} />
        <ChartCard title="상해종류" labels={inj.map((x) => x[0])} values={inj.map((x) => x[1])} unit="%" type="bar" rotate />
      </div>}

      {sp.modal === "upload" && (
        <div className="us-modal-bg">
          <div className="us-modal usg-up">
            <div className="us-modal-h">업로드<Link href={`/stats/occur?${back}`} className="usg-x">✕</Link></div>
            <form className="us-modal-b" action={uploadOccur}>
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="back" value={back} />
              {sp.err && <div className="usg-err">{sp.err}</div>}
              <p>엑셀에서 표를 「CSV UTF-8(쉼표로 분리)」로 저장해 올리면 한 줄씩 원장에 더합니다.<br />머리 줄은 화면 표와 같은 20칸(연도별 ~ 비고)이며, 「사고발생일」(YYYY-MM-DD)과 「재해유형」은 꼭 채웁니다.</p>
              <div className="usg-up-row">
                <input type="file" name="occ_file" accept=".csv,text/csv" />
                <span className="us-muted">※개당 10MB 이하</span>
              </div>
              <div className="usg-up-btns">
                <a className="usg-btn-o" href={`/stats/export?kind=occur&tpl=1&${back}`}>양식 내려받기</a>
                <button className="us-btn g" type="submit">올리기</button>
                <Link className="us-btn w" href={`/stats/occur?${back}`}>닫기</Link>
              </div>
            </form>
          </div>
        </div>
      )}
    </UsLayout>
  );
}
