import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import MenuSide from "@/components/us/MenuSide";
import { Stat } from "@/components/bits";
import StaffPicker from "@/components/StaffPicker";
import { ROLE_STAFF, deptOf } from "@/lib/roles";
import { loadHazards, assetOptions, staffOpts, REPEAT_N, type Hz } from "./load";
import { CHANNELS, ACCIDENT_TYPES, hid, nextOf, ddayLabel } from "./codes";
import { AssetPicker, CodePicker, ChannelPicker } from "./Pickers";
import { createReport } from "./actions";
import Steps, { type Step } from "@/components/Steps";
import s from "./hazards.module.css";

export const dynamic = "force-dynamic";

// [캡처 v2] 설명 문단·법령 인용 상자·경고 목록·표 보조 줄 제거, 맨 위 단계 막대, 표 6칸 한 줄(09-22)
/** 단계 막대 묶음 — 신고가 지금 기다리는 일. */
const GROUP: Record<string, string> = {
  "접수": "방지", "피해방지": "판단", "1차 판단": "보고", "경영책임자 보고": "점검",
  "긴급안전점검": "개선", "개선 지시": "개선", "보수·보강 계획": "개선", "종결": "종결", "완료": "종결",
};
const groupOf = (r: Hz) => (r.severity === "경미" && r.stage === "1차 판단" ? "개선" : GROUP[r.stage] || "");

export default async function Hazards({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const v = sp.v || "list";
  const myDept = deptOf(role);
  const { rows: all, deptName, staff } = await loadHazards();
  const rows = myDept && role !== "mgr" ? all.filter((r) => r.dept_id === myDept) : all;

  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ role });
    const m: Record<string, string | undefined> = { v, f: sp.f, d: sp.d, g: sp.g, ...o };
    Object.entries(m).forEach(([k, x]) => x && p.set(k, x));
    return `/hazards?${p.toString()}`;
  };

  const open = rows.filter((r) => r.open);
  const serious = rows.filter((r) => r.severity === "심각");
  const seriousOpen = serious.filter((r) => r.open);
  const waitCeo = serious.filter((r) => !r.ceo_reported_at);
  const repeat = rows.filter((r) => r.repeatN >= REPEAT_N);
  const late = rows.filter((r) => r.deadline && (r.deadline.startLate || r.deadline.doneLate));
  const soon = rows.filter((r) => r.deadline && !r.deadline.startLate && !r.deadline.doneLate &&
    ((r.deadline.startLeft ?? 999) <= 60 || (r.deadline.doneLeft ?? 999) <= 60));
  const warnSet = new Set([...late, ...soon, ...waitCeo.filter((r) => r.reportLate)].map((r) => r.hz_id));

  let shown = rows;
  if (sp.f === "open") shown = open;
  if (sp.f === "serious") shown = serious;
  if (sp.f === "ceo") shown = waitCeo;
  if (sp.f === "repeat") shown = repeat;
  if (sp.f === "due") shown = rows.filter((r) => warnSet.has(r.hz_id));
  if (sp.g) shown = shown.filter((r) => groupOf(r) === sp.g);
  if (sp.d) shown = shown.filter((r) => r.dept_id === sp.d);
  const LIMIT = 15;
  const page = sp.all ? shown : shown.slice(0, LIMIT);

  const repGroups = new Set(repeat.map((r) => `${r.asset_id}|${r.accident_type}`));

  // [캡처 v2] 업무이행 단계 — 방지 → 판단 → 보고 → 점검 → 개선 → 종결
  const n = (g: string) => rows.filter((r) => groupOf(r) === g).length;
  const steps: Step[] = ["방지", "판단", "보고", "점검", "개선", "종결"].map((g) => {
    const c = n(g);
    const warn = g === "보고" && waitCeo.some((r) => r.reportLate);
    return { label: g, n: c, href: q({ v: "list", g: sp.g === g ? undefined : g, f: undefined }),
      state: g === "종결" ? "done" : warn ? "warn" : sp.g === g || (c && !sp.g && g === "방지") ? "on" : "" };
  });

  return (
    <UsLayout side={<MenuSide group="이행점검및 조치" />}>   {/* 09-25: 좌측 = 머리 메뉴 이행점검 및 조치 */}
      <h1 className="v2h">유해·위험요인 점검·개선</h1>
      <div className="chips">
        <span className="badge">시행령 제10조제7호</span>
        <span className="badge none">{myDept && role !== "mgr" ? deptName.get(myDept) : "전 부서"}</span>
      </div>

      <Steps items={steps} />

      <nav className={s.tabs}>
        <Link className={v === "list" ? s.on : ""} href={q({ v: "list" })}>신고 목록</Link>
        <Link className={v === "new" ? s.on : ""} href={q({ v: "new" })}>새 신고</Link>
        <Link className={v === "stat" ? s.on : ""} href={q({ v: "stat" })}>분석</Link>
      </nav>

      {v === "new" && <NewForm role={role} staffOpts={staffOpts(staff, deptName)} assets={await assetOptions(deptName)} />}
      {v === "stat" && <Analysis rows={rows} deptName={deptName} />}

      {v === "list" && (
        <>
          <div className={`grid g6 ${s.stats}`}>
            <Stat n={rows.length} l="전체" href={q({ f: undefined, g: undefined })} />
            <Stat n={open.length} l="처리 중" tone={open.length ? "warn" : ""} href={q({ f: "open" })} />
            <Stat n={seriousOpen.length} l="심각" tone={seriousOpen.length ? "bad" : ""} href={q({ f: "serious" })} />
            <Stat n={waitCeo.length} l="보고 대기" tone={waitCeo.length ? "bad" : ""} href={q({ f: "ceo" })} />
            <Stat n={repGroups.size} l="반복" tone={repGroups.size ? "warn" : ""} href={q({ f: "repeat" })} />
            <Stat n={late.length + soon.length} l="기한 임박" tone={late.length ? "bad" : soon.length ? "warn" : ""} href={q({ f: "due" })} />
          </div>

          <div className="chips">
            <Link className={`chip ${!sp.d ? "on" : ""}`} href={q({ d: undefined })}>전체</Link>
            {[...new Set(rows.map((r) => r.dept_id))].map((d) => (
              <Link key={d} className={`chip ${sp.d === d ? "on" : ""}`} href={q({ d })}>{deptName.get(d) || d}</Link>
            ))}
            {(sp.f || sp.g) && <Link href={q({ f: undefined, g: undefined })}>모두 보기</Link>}
            <span style={{ flex: 1 }} />
            <Link className="btn sm" href={q({ v: "new" })}>+ 새 신고</Link>
          </div>

          <table className="v2t">
            <thead><tr>
              <th>번호</th>
              <th className="dt">접수</th>
              <th>시설</th>
              <th className="cd">판단</th>
              <th>단계</th>
              <th>다음·기한</th>
            </tr></thead>
            <tbody>
              {page.map((r) => {
                const dl = r.deadline;
                const d = dl && r.open ? (r.fix_started_at && dl.doneLeft !== null
                  ? { l: dl.doneLeft, bad: dl.doneLate } : dl.startLeft !== null ? { l: dl.startLeft, bad: dl.startLate } : null) : null;
                return (
                  <tr key={r.hz_id} className={r.repeatN >= REPEAT_N ? s.repeat : ""}>
                    <td><Link href={`/hazards/${r.hz_id}?role=${role}`}>{hid(r.hz_id)}</Link></td>
                    <td className="dt">{String(r.received_at).slice(5, 10)}</td>
                    <td title={`${r.asset_name} ${r.location || ""} — ${r.description}`}>{r.asset_name}</td>
                    <td className="cd">{r.severity ? <span className={`badge ${r.severity === "심각" ? "bad" : "ok"}`}>{r.severity}</span> : <span className="badge none">전</span>}</td>
                    <td>{r.stage}</td>
                    <td>{r.open ? nextOf(r).replace(/\(.*\)/, "") : <span className="muted">끝남</span>}
                      {d && <> <span className={`badge ${d.bad ? "bad" : d.l! <= 60 ? "warn" : "none"}`}>{ddayLabel(d.l!)}</span></>}</td>
                  </tr>
                );
              })}
              {!page.length && <tr><td colSpan={6} className="muted">없음</td></tr>}
            </tbody>
          </table>
          {!sp.all && shown.length > LIMIT && <Link className="more" href={q({ all: "1" })}>전체 {shown.length}건 →</Link>}
        </>
      )}
    </UsLayout>
  );
}

/* ── 새 신고 접수 ───────────────────────────────────────────── */
function NewForm({ role, staffOpts, assets }: { role: string; staffOpts: any[]; assets: any[] }) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const local = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  return (
    <form action={createReport} className="card">
      <input type="hidden" name="role" value={role} />
      <h3>새 신고</h3>
      <div className={s.form}>
        <div><label>접수 경로</label><ChannelPicker channels={CHANNELS} /></div>
        <div><label>접수 일시</label><input type="datetime-local" name="received_at" defaultValue={local} /></div>
        <div className={s.wide}><label>시설 *</label><AssetPicker assets={assets} /></div>
        <div><label>위치</label><input type="text" name="location" placeholder="예: 2번 출입구 계단" /></div>
        <div><label>신고자</label><input type="text" name="reporter" placeholder="시민 · 직원 이름" /></div>
        <div className={s.wide}><label>내용 *</label>
          <textarea name="description" required placeholder="예: 계단 미끄럼 방지 홈 마모" /></div>
        <div><label>분류 코드</label><CodePicker /></div>
        <div><label>사고유형</label>
          <select name="accident_type" defaultValue="넘어짐">{ACCIDENT_TYPES.map((a) => <option key={a}>{a}</option>)}</select></div>
        <div className={s.wide}><label>발생 가능 사고</label>
          <input type="text" name="possible_accident" placeholder="예: 계단에서 넘어짐" /></div>
        <div className={s.wide}><label>사진 2장</label>
          <div className={s.photos}>
            <div className={s.photo}><b>① 전경</b><input type="file" name="photo_wide" accept="image/*" capture="environment" /></div>
            <div className={s.photo}><b>② 근접</b><input type="file" name="photo_close" accept="image/*" capture="environment" /></div>
          </div></div>
        <div className={s.wide}><label>접수자</label><StaffPicker name="received_by" staff={staffOpts} defaultValue={ROLE_STAFF[role] || ""} label="접수자" /></div>
      </div>
      <div style={{ marginTop: 14 }}>
        <button className="btn" type="submit">접수</button>
      </div>
    </form>
  );
}

/* ── 총괄 분석(환류) ─────────────────────────────────────────── */
function Analysis({ rows, deptName }: { rows: Hz[]; deptName: Map<string, string> }) {
  const by = (f: (r: Hz) => string) => {
    const m = new Map<string, { n: number; serious: number }>();
    rows.forEach((r) => {
      const k = f(r) || "(없음)";
      const x = m.get(k) || { n: 0, serious: 0 };
      x.n++; if (r.severity === "심각") x.serious++;
      m.set(k, x);
    });
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  };
  const max = (xs: [string, { n: number }][]) => Math.max(1, ...xs.map((x) => x[1].n));
  const Block = ({ title, data }: { title: string; data: [string, { n: number; serious: number }][] }) => (
    <div className="card">
      <h3>{title}</h3>
      {data.slice(0, 10).map(([k, x]) => (
        <div key={k} className={s.brow}>
          <span className={s.nm} title={k}>{k}</span>
          <div className="bar"><i style={{ width: `${(x.n / max(data)) * 100}%` }} /></div>
          <span className={s.cnt}>{x.n}{x.serious ? <span className="muted"> · 심각 {x.serious}</span> : null}</span>
        </div>
      ))}
    </div>
  );
  const minorDays = rows.filter((r) => r.severity === "경미" && r.closed_at).map((r) =>
    Math.max(0, Math.round((+new Date(r.closed_at) - +new Date(String(r.received_at).slice(0, 10))) / 86400000)));
  const avg = minorDays.length ? (minorDays.reduce((a, b) => a + b, 0) / minorDays.length).toFixed(1) : "—";
  const citizen = rows.filter((r) => r.channel === "시민 신고");
  const notified = citizen.filter((r) => r.notified_reporter === "Y").length;
  const closedCitizen = citizen.filter((r) => r.closed_at).length;

  return (
    <>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Stat n={rows.length} l="신고" />
        <Stat n={rows.filter((r) => r.severity === "심각").length} l="심각" tone="bad" />
        <Stat n={`${avg}일`} l="경미 처리" />
        <Stat n={`${notified}/${closedCitizen}`} l="신고자 통보" tone={notified < closedCitizen ? "warn" : "ok"} />
      </div>
      <div className={s.anal}>
        <Block title="사고유형" data={by((r) => r.accident_type)} />
        <Block title="분류 코드" data={by((r) => `${r.code_group} · ${r.code}`)} />
        <Block title="부서" data={by((r) => deptName.get(r.dept_id) || r.dept_id)} />
        <Block title="시설유형" data={by((r) => r.asset_gbn)} />
        <Block title="접수 경로" data={by((r) => r.channel)} />
        <Block title="월별" data={by((r) => String(r.received_at).slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0]))} />
      </div>
    </>
  );
}
