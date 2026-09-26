/**
 * 안전·보건 예산 — 「전체(두 재해 합계)」 보기(09-26 사용자: 「경영책임자나 총괄 입장에서는 그 통계도 필요하지 않을까? 일단 넣어 보자.」).
 * 기초자료(교육자료) 「중대재해 안전예산 = 중대산업재해 예산 + 중대시민재해 예산」.
 * 중대시민재해 = 공중이용시설·공중교통수단 + 원료·제조물. 읽기만 한다(편성·집행 입력은 재해 구분 탭에서).
 * 집행률은 버림(09-26 사용자: 소수점은 보수적으로 버림).
 */
import Link from "next/link";
import { Facts } from "@/components/Steps";
import { FRAMES, AREAS, sum, mil, type Bud, type AreaKey } from "./model";
import { floor1 } from "@/lib/num";
import type { Row } from "@/lib/data";

const rateF = (p: number, e: number) => (p > 0 ? floor1((e / p) * 100) : 0);

export default function TotalView({ rows, dl, deptName, q }: {
  rows: Bud[]; dl: Row[]; deptName: Map<string, string>; q: (href: string) => string;
}) {
  const ofTab = (a: AreaKey) => rows.filter((r) => r.tab === a);
  const I = sum(ofTab("I"));
  const civRows = rows.filter((r) => r.tab === "F" || r.tab === "M");
  const C = sum(civRows);
  const T = sum(rows);
  const cell = (x: { p: number; e: number }) => (
    <>
      <td className="num"><b>{x.p ? mil(x.p) : "-"}</b></td>
      <td className="num">{x.p || x.e ? mil(x.e) : "-"}</td>
      <td className="num">{x.p ? `${rateF(x.p, x.e).toFixed(1)}%` : "-"}</td>
    </>
  );
  const depts = dl
    .map((d) => {
      const rs = rows.filter((r) => r.dept_id === d.dept_id);
      return { d, i: sum(rs.filter((r) => r.tab === "I")), c: sum(rs.filter((r) => r.tab === "F" || r.tab === "M")), t: sum(rs) };
    })
    .filter((x) => x.t.p || x.t.e)
    .sort((a, b) => b.t.p - a.t.p);

  return (
    <>
      <Facts items={[
        { k: "중대재해 안전예산(편성)", v: <b>{mil(T.p)}</b> },
        { k: "집행", v: mil(T.e) },
        { k: "집행률", v: <b>{rateF(T.p, T.e).toFixed(1)}%</b> },
        { k: "중대산업재해 : 중대시민재해", v: T.p ? `${floor1((I.p / T.p) * 100).toFixed(1)} : ${floor1((C.p / T.p) * 100).toFixed(1)}` : "-" },
      ]} />
      <p className="muted" style={{ margin: ".4rem 0 .8rem" }}>
        중대재해 안전예산 = 중대산업재해 예산 + 중대시민재해 예산(공중이용시설·공중교통수단 + 원료·제조물). 단위 백만원 · 집행률은 소수점 한 자리에서 버립니다.
        편성·집행 입력은 재해 구분 탭에서 합니다.
      </p>

      <h2>재해 구분별</h2>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>재해 구분</th><th>근거</th><th className="num">편성</th><th className="num">집행</th><th className="num">집행률</th><th className="num">줄</th></tr></thead>
          <tbody>
            {AREAS.map((a) => {
              const rs = ofTab(a);
              return (
                <tr key={a}>
                  <td><Link href={q(`/budget?area=${a}`)}>{FRAMES[a].tab}</Link></td>
                  <td className="muted">{FRAMES[a].basis}</td>
                  {cell(sum(rs))}
                  <td className="num">{rs.length}</td>
                </tr>
              );
            })}
            <tr style={{ background: "#f4f7f2" }}><td><b>중대시민재해 소계</b></td><td className="muted">공중이용시설·공중교통수단 + 원료·제조물</td>{cell(C)}<td className="num">{civRows.length}</td></tr>
            <tr style={{ background: "#e8f0e3" }}><td><b>합계</b></td><td /> {cell(T)}<td className="num">{rows.length}</td></tr>
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: "1.2rem" }}>부서별 <span className="muted">{depts.length}</span></h2>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th rowSpan={2}>부서</th><th colSpan={3}>중대산업재해</th><th colSpan={3}>중대시민재해</th><th colSpan={3}>합계</th></tr>
            <tr>{["편성", "집행", "집행률", "편성", "집행", "집행률", "편성", "집행", "집행률"].map((h, i) => <th key={i} className="num">{h}</th>)}</tr>
          </thead>
          <tbody>
            {depts.map((x) => (
              <tr key={x.d.dept_id}>
                <td><b>{deptName.get(x.d.dept_id) || x.d.dept_name}</b></td>
                {cell(x.i)}{cell(x.c)}{cell(x.t)}
              </tr>
            ))}
            {!depts.length && <tr><td colSpan={10} className="muted">편성된 예산이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
