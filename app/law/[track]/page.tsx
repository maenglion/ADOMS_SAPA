// [400 · 교육자료 버전] SCR-034·035 법 의무사항 — (사업장, 부서) 관계 법령 관리
//  09-25 사용자: 사업장 트랙 대상 = 용인시 사업장 20곳(본청은 그대로 · 나머지 19곳은 과제 없음 안내 + 빈 표 입력)
//  · 목록(SCR-034): 시설구분 · 검색조건 · 진행현황(미입력/입력중) · 대상 목록
//  · 대상 선택(SCR-035): 법 / 시행령 / 의무사항 / 이행 시기 계층표 + ④ 관계 법령 의무 목록(우리 의무 목록 duties({area}) 을 법령별로)
//  주소: /law/ws · /law/fc · /law/mt  (?target=… 이면 SCR-035)
import { assignedIds } from "@/lib/us/links";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UsLayout } from "@/components/us/Parts";
import MenuSide from "@/components/us/MenuSide";
import { trackOf, type TrackKey } from "@/lib/us/tracks";
import { duties } from "@/lib/data";
import {
  ITEMS, LAW_COL, FACILITY_TYPES, WP_TYPES, targetsOf, records, hasInput, dutiesForTarget, groupByLaw, areaOf,
  tname, isOtherWp, type Item, type Target, type Rec, type LawGroup,
} from "../_lib";
import { saveTiming, addLaw } from "../actions";
import { Pager, Count, SearchBox, Modal, Note, qs } from "../../admin/_ui";

export const dynamic = "force-dynamic";
const SIZE = 15;

export default async function LawTrack({ params, searchParams }: {
  params: Promise<{ track: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { track: tk } = await params;
  if (!["ws", "fc", "mt"].includes(tk)) notFound();
  const track = tk as TrackKey;
  const sp = await searchParams;
  const role = sp.role || "gm";
  const T = trackOf(track);
  // 관리자 「담당자 관리대상 지정」이 있으면 담당자는 지정받은 대상만 본다(lib/us/links)
  // 09-26 사용자: 「원료·제조물에 관리대상이 하나도 없다 — 채워줘」 → 법 의무사항은 보기 화면이라 역할과 상관없이 모든 대상을 보인다
  //   (전: 담당자·관리자는 자기 부서 것만 · 지정받은 것만 — 도로구조물과·관리자는 원료·제조물 0건). 사업장은 09-26 에 먼저 이렇게 바꿨다.
  //   지정받은 대상은 목록 맨 앞에 둔다(자기 몫을 먼저 보게).
  const asg = await assignedIds(role, track === "ws" ? "ind" : "civ");
  const mineFirst = (xs: Awaited<ReturnType<typeof targetsOf>>) => asg && asg.size ? [...xs.filter((t) => asg.has(t.id)), ...xs.filter((t) => !asg.has(t.id))] : xs;
  const all = mineFirst(await targetsOf(track, ""));
  const recs = await records(track);

  const side = <MenuSide group="법 의무사항" />;   // 09-25: 좌측 = 머리 메뉴 법 의무사항과 같은 구성
  const target = sp.target ? all.find((t) => t.id === sp.target) : undefined;

  return (
    <UsLayout side={side}>
      {target
        ? <Detail track={track} t={target} rec={recs.get(target.id)} sp={sp} role={role} />
        : <>
            {/* 09-26 사용자: 「청사 소독제·세정제는 관련 법령이 없는데 의무도 안 되는 거 아냐?」 — 해당 판단이 「비해당」인 원료·제조물은 의무 대상 목록에서 빼고 아래에 근거와 함께 따로 보인다 */}
            <List track={track} list={all.filter((t) => t.verdict !== "비해당")} recs={recs} sp={sp} label={T.label} />
            {all.some((t) => t.verdict === "비해당") && (
              <div className="us-card w lawna-box">
                <b>중대재해처벌법 원료·제조물 비해당으로 판단한 것</b> <span className="us-muted">— 의무 대상이 아니라 목록에서 뺐습니다</span>
                <ul>
                  {all.filter((t) => t.verdict === "비해당").map((t) => (
                    <li key={t.id}><b>{t.name}</b> <span className="us-muted">({t.dept})</span> — {t.reason}{t.basis && <span className="us-muted"> · 근거: {t.basis}</span>}</li>
                  ))}
                </ul>
              </div>
            )}
          </>}
    </UsLayout>
  );
}

/* ── SCR-034 목록 ─────────────────────────────────────────────────── */
function List({ track, list, recs, sp, label }: { track: TrackKey; list: Target[]; recs: Map<string, Rec>; sp: Record<string, string>; label: string }) {
  const ft = sp.ft || "전체";
  const wk = sp.wk || "전체";   // 09-25 사용자: 사업장 20곳 — 사업장 구분(본청·의회·구청·직속기관·사업소·직영시설)
  const by = sp.by || "name";
  const q = (sp.q || "").trim();
  let rows = list;
  if (track === "fc" && ft !== "전체") rows = rows.filter((t) => t.kind === ft);
  if (track === "ws" && wk !== "전체") rows = rows.filter((t) => t.kind === wk);
  if (q) rows = rows.filter((t) => (by === "addr" ? t.addr : by === "owner" ? `${t.owner} ${t.dept}` : t.name).includes(q));
  const ing = rows.filter((t) => hasInput(recs.get(t.id))).length;
  const page = Math.max(1, Number(sp.p || 1));
  const shown = rows.slice((page - 1) * SIZE, page * SIZE);
  const base = `/law/${track}`;
  const unit = track === "mt" ? "건" : "개소";
  const nameLabel = track === "ws" ? "사업장명" : track === "mt" ? "원료·제조물명" : "시설물명";

  return (
    <>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">법 의무사항</span> {label}</h1>
      </div>
      <form method="get" action={base} className="usb2-panel">
        {track === "fc" && (
          <div className="usb2-prow">
            <div className="usb2-plabel">시설구분</div>
            <div className="usb2-pbody usb2-radios">
              {FACILITY_TYPES.map((x) => (
                <label key={x}><input type="radio" name="ft" value={x} defaultChecked={x === ft} /> {x}</label>
              ))}
            </div>
          </div>
        )}
        {track === "ws" && list.length > 1 && (
          <div className="usb2-prow">
            <div className="usb2-plabel">사업장 구분</div>
            <div className="usb2-pbody usb2-radios">
              {WP_TYPES.map((x) => (
                <label key={x}><input type="radio" name="wk" value={x} defaultChecked={x === wk} /> {x}</label>
              ))}
            </div>
          </div>
        )}
        <div className="usb2-prow">
          <div className="usb2-plabel">검색조건</div>
          <div className="usb2-pbody usb2-search">
            <select name="by" defaultValue={by}>
              <option value="name">{nameLabel}</option>
              {track !== "mt" && <option value="addr">주소</option>}
              <option value="owner">담당자</option>
            </select>
            <input type="text" name="q" defaultValue={q} placeholder={`${nameLabel}을 입력하세요`} />
            <button className="usb2-sbtn" type="submit">🔍 검색</button>
          </div>
        </div>
        <div className="usb2-prow">
          <div className="usb2-plabel">진행현황</div>
          <div className="usb2-pbody usb2-split">
            <div><span>미입력</span><b>{(rows.length - ing).toLocaleString()}</b><small>{unit}</small></div>
            <div><span>입력중</span><b>{ing.toLocaleString()}</b><small>{unit}</small></div>
          </div>
        </div>
      </form>

      <Count n={rows.length} unit={unit} />
      <table className="us-tbl usb2-click">
        <thead>
          {track === "fc" && <tr><th>시설물명</th><th>주소</th><th>시설구분</th><th>담당자</th><th>소속</th></tr>}
          {track === "ws" && <tr><th>사업장명</th><th>주소</th><th>사업장 구분</th><th>담당자</th><th>소속</th></tr>}
          {track === "mt" && <tr><th>원료·제조물명</th><th>관련 법령</th><th>담당자</th><th>소속</th></tr>}
        </thead>
        <tbody>
          {shown.map((t) => {
            const href = qs(base, { target: t.id });
            const on = hasInput(recs.get(t.id));
            return (
              <tr key={t.id} className={on ? "hl" : ""}>
                <td><Link href={href}>{t.name}</Link></td>
                {track === "mt" ? <td>{(t.laws || []).join(" · ")}</td> : <td>{t.addr}</td>}
                {track !== "mt" && <td className="c">{t.kind}</td>}
                {isOtherWp(t)
                  ? <td colSpan={2} className="c us-muted">이행 과제 없음 · 소속 부서는 용인시 확인 뒤</td>
                  : <><td className="c">{t.owner}</td><td>{t.dept}</td></>}
              </tr>
            );
          })}
          {!shown.length && <tr><td colSpan={5} className="c usb2-empty">조회된 대상이 없습니다</td></tr>}
        </tbody>
      </table>
      <Pager total={rows.length} size={SIZE} page={page} href={(p) => qs(base, { ft: track === "fc" ? ft : "", wk: track === "ws" ? wk : "", by, q, p })} />
    </>
  );
}

/* ── SCR-035 대상별 이행 시기 + 관계 법령 ─────────────────────────────── */
async function Detail({ track, t, rec, sp, role }: { track: TrackKey; t: Target; rec?: Rec; sp: Record<string, string>; role: string }) {
  const hidden = new Set(rec?.hidden || []);
  const items = ITEMS[track].filter((i) => !hidden.has(i.id));
  const vals = rec?.vals || {};
  const lawsSaved = rec?.laws || {};

  // ④ 관계 법령 — 우리 의무 목록에서 이 대상의 관리대상 유형(원료·제조물은 관련 법령)으로 고른 의무를 법령별로
  const mine = groupByLaw(await dutiesForTarget(track, t));
  const areaAll = await duties({ area: areaOf(track), limit: 1000000 });
  const extraNames = Object.entries(lawsSaved).filter(([k, v]) => v?.extra && !mine.some((g) => g.law === k)).map(([k]) => k);
  const extra = groupByLaw(areaAll.filter((d) => extraNames.includes(d.law)));
  const groups: (LawGroup & { extra?: boolean })[] = [...mine, ...extra.map((g) => ({ ...g, extra: true }))];
  const base = `/law/${track}`;
  const self = qs(base, { target: t.id });
  const codeNames = [...new Set(mine.flatMap((g) => g.rows.map((r) => tname(r.target_name))))].filter(Boolean);

  return (
    <>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">법 의무사항</span> {trackOf(track).label}</h1>
        <div className="us-head-r"><span className="us-target"><b>대상</b><span className="usb2-tbox">{t.name}</span></span></div>
      </div>
      {/* 09-25 사용자: 사업장 20곳 기준 — 본청 밖 사업장은 과제가 없다. 이행 시기는 적어 둘 수 있다(저장 키 = 사업장 번호). */}
      {isOtherWp(t) && (
        <Note>이 사업장에는 아직 이행 과제가 없습니다 — 사업장 단위는 용인시 확인 뒤 정합니다. 이행 시기는 미리 적어 둘 수 있습니다.{t.kind ? ` (${t.kind} · ${t.wp_state || "확인필요"})` : ""}</Note>
      )}
      {sp.saved && <Note>저장했습니다.</Note>}
      {sp.reset && <Note>항목을 초기화했습니다.</Note>}
      {sp.added && <Note>관계 법령을 추가했습니다.</Note>}

      <form action={saveTiming}>
        <input type="hidden" name="track" value={track} />
        <input type="hidden" name="target" value={t.id} />
        <input type="hidden" name="role" value={role} />
        {/* 입력 칸에서 Enter 를 누르면 첫 제출 단추가 눌린다 — 🗑 가 눌리지 않게 맨 앞에 「저장」을 숨겨 둔다 */}
        <button type="submit" className="usb2-ghost" tabIndex={-1} aria-hidden="true">저장</button>
        <HierTable track={track} items={items} vals={vals} />

        <h2 className="us-h2" id="laws">④ 관계 법령상 의무이행 — 관계 법령 의무 목록</h2>
        <div className="usb2-lawhead">
          <span className="us-muted">
            {track === "mt"
              ? `이 원료·제조물의 관련 법령(${(t.laws || []).join(" · ")})에 걸리는 의무를 의무 목록에서 법령별로 묶었습니다.`
              : isOtherWp(t)
                ? "이 사업장에 걸리는 관리대상 유형은 용인시 확인 뒤 정합니다. 필요한 법령은 「법령 검색」으로 추가할 수 있습니다."
                : `이 대상의 관리대상 유형(${codeNames.join(" · ") || "없음"})에 걸리는 의무를 의무 목록에서 법령별로 묶었습니다.`}
          </span>
          <Link className="us-btn w" href={qs(base, { target: t.id, modal: "law" })}>🔍 법령 검색</Link>
        </div>
        <input type="hidden" name="law_n" value={groups.length} />
        <table className="us-tbl usb2-laws">
          <thead>
            <tr><th style={{ width: 50 }}>No</th><th>법령명</th><th style={{ width: 170 }}>법령구분</th><th style={{ width: 90 }}>의무 수</th>
              <th style={{ width: 80 }}>확정</th><th style={{ width: 80 }}>조건부</th><th style={{ width: 70 }}>지정</th><th style={{ width: 170 }}>이행 시기</th></tr>
          </thead>
          <tbody>
            {groups.map((g, i) => {
              const s = lawsSaved[g.law];
              const on = s ? !!s.on : g.y > 0 || !!g.extra;
              return (
                <tr key={g.law} className={on ? "" : "usb2-off"}>
                  <td className="c">{i + 1}
                    <input type="hidden" name={`law_name_${i}`} value={g.law} />
                    {g.extra && <input type="hidden" name={`law_extra_${i}`} value="Y" />}
                  </td>
                  <td>
                    <details className="usb2-det">
                      <summary><b>{g.law}</b>{g.extra && <span className="usb2-tag">추가</span>}</summary>
                      <div className="usb2-docs">문서: {g.docs.join(" · ")}</div>
                      <table className="usb2-mini">
                        <tbody>
                          {g.rows.slice(0, 40).map((r) => (
                            <tr key={r.duty_key}>
                              <td>{r.doc}</td><td>{r.unit_label_ko}</td>
                              <td><Link href={`/duties/${r.duty_key}`}>{r.duty_name}</Link></td>
                              <td className="c">{r.yongin_mark === "Y" ? "확정" : "조건부"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {g.rows.length > 40 && <div className="us-muted">… 외 {g.rows.length - 40}건</div>}
                    </details>
                  </td>
                  <td className="c">{g.kinds.join("·")}</td>
                  <td className="n">{g.n.toLocaleString()}</td>
                  <td className="n">{g.y.toLocaleString()}</td>
                  <td className="n">{g.c.toLocaleString()}</td>
                  <td className="c"><input type="checkbox" name={`law_on_${i}`} value="Y" defaultChecked={on} className="usb2-chk" /></td>
                  <td><input type="month" name={`law_when_${i}`} defaultValue={s?.when || ""} /></td>
                </tr>
              );
            })}
            {!groups.length && <tr><td colSpan={8} className="c usb2-empty">{isOtherWp(t)
              ? "이 사업장에는 아직 관계 법령이 지정되지 않았습니다. 「법령 검색」으로 추가할 수 있습니다."
              : "의무 목록에서 이 대상에 걸리는 관계 법령을 찾지 못했습니다. 「법령 검색」으로 추가하세요."}</td></tr>}
          </tbody>
        </table>
        <p className="us-muted usb2-small">지정 기본값: 용인시에 확정된 의무가 있는 법령은 지정, 조건부 의무만 있는 법령은 미지정(조건 확인 뒤 지정).</p>

        <div className="usb2-actions">
          <div className="us-flex">
            <button className="us-btn w" name="op" value="reset">항목 초기화</button>
            {hidden.size > 0 && <button className="us-btn w" name="op" value="restore">삭제한 항목 되살리기({hidden.size})</button>}
            <Link className="us-btn w" href={base}>〈 목록으로</Link>
          </div>
          <button className="us-btn" type="submit">저장</button>
        </div>
        {rec?.saved_at && <p className="us-muted usb2-small">마지막 저장 {rec.saved_at}</p>}
      </form>

      {sp.modal === "law" && <LawSearch track={track} t={t} q={sp.q || ""} exclude={groups.map((g) => g.law)} close={self} role={role} />}
    </>
  );
}

/** 계층표(법 / 시행령 / 의무사항 / 이행 시기) — 명세 SCR-035 의 병합 구조 그대로. */
function HierTable({ track, items, vals }: { track: TrackKey; items: Item[]; vals: Record<string, string> }) {
  const cnt = (f: (i: Item) => boolean) => items.filter(f).length;
  const firstOf = (i: Item, f: (j: Item) => boolean) => items.find(f) === i;
  return (
    <table className="us-tbl usb2-hier">
      <colgroup><col style={{ width: 44 }} /><col style={{ width: "19%" }} /><col style={{ width: "20%" }} /><col /><col style={{ width: "12%" }} /><col style={{ width: "8%" }} /><col style={{ width: 220 }} /></colgroup>
      <thead><tr><th colSpan={2}>법</th><th>시행령</th><th colSpan={3}>의무사항</th><th>이행 시기</th></tr></thead>
      <tbody>
        {items.map((it) => {
          const gFirst = firstOf(it, (j) => j.g === it.g);
          const stepFirst = it.step && firstOf(it, (j) => j.g === it.g && j.step === it.step);
          const dutyFirst = it.duty && firstOf(it, (j) => j.step === it.step && j.duty === it.duty);
          const subFirst = it.sub && firstOf(it, (j) => j.step === it.step && j.duty === it.duty && j.sub === it.sub);
          const trash = it.del ? <button className="usb2-trash" name="del" value={it.id} title="항목 삭제">🗑</button> : null;
          return (
            <tr key={it.id}>
              {gFirst && <td className="c usb2-no" rowSpan={cnt((j) => j.g === it.g)}>{"①②③④"[it.g - 1]}</td>}
              {gFirst && (it.step
                ? <td rowSpan={cnt((j) => j.g === it.g)}>{LAW_COL[track][it.g]}</td>
                : <td colSpan={5}>{LAW_COL[track][it.g]}</td>)}
              {stepFirst && <td rowSpan={cnt((j) => j.g === it.g && j.step === it.step)}>{it.step}</td>}
              {dutyFirst && (it.sub
                ? <td rowSpan={cnt((j) => j.step === it.step && j.duty === it.duty)}>{it.duty}</td>
                : <td colSpan={3}><span className="usb2-cellx">{it.duty}{trash}</span></td>)}
              {it.sub && subFirst && (it.sub2
                ? <td rowSpan={cnt((j) => j.step === it.step && j.duty === it.duty && j.sub === it.sub)}>{it.sub}</td>
                : <td colSpan={2}><span className="usb2-cellx">{it.sub}{trash}</span></td>)}
              {it.sub2 && <td><span className="usb2-cellx">{it.sub2}{trash}</span></td>}
              <td className="c">
                {it.input === "ym"
                  ? <input type="month" name={`v_${it.id}`} defaultValue={vals[it.id] || ""} className="usb2-month" />
                  : <span className="usb2-half">
                      {["상반기", "하반기"].map((h) => (
                        <label key={h}><input type="radio" name={`v_${it.id}`} value={h} defaultChecked={vals[it.id] === h} /> {h}</label>
                      ))}
                    </span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** 법령 검색 모달 — 우리 의무 목록(이 트랙 재해 구분)의 법령에서 찾는다. */
async function LawSearch({ track, t, q, exclude, close, role }: { track: TrackKey; t: Target; q: string; exclude: string[]; close: string; role: string }) {
  const rows = await duties({ area: areaOf(track), q: q || undefined, limit: 1000000 });
  const groups = groupByLaw(rows).filter((g) => !exclude.includes(g.law)).slice(0, 30);
  return (
    <Modal title="법령 검색" close={close} wide>
      <form method="get" action={`/law/${track}`} className="usb2-search">
        <input type="hidden" name="target" value={t.id} />
        <input type="hidden" name="modal" value="law" />
        <input type="text" name="q" defaultValue={q} placeholder="법령 및 내용을 입력하세요" />
        <button className="usb2-sbtn" type="submit">🔍 검색</button>
      </form>
      <p className="us-muted usb2-small">의무 목록({trackOf(track).disaster} · {trackOf(track).label})에 있는 법령 중 이 대상에 아직 없는 것입니다.</p>
      <table className="us-tbl">
        <thead><tr><th>법령명</th><th>법령구분</th><th>의무 수</th><th>확정</th><th></th></tr></thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.law}>
              <td>{g.law}</td><td className="c">{g.kinds.join("·")}</td><td className="n">{g.n.toLocaleString()}</td><td className="n">{g.y.toLocaleString()}</td>
              <td className="c">
                <form action={addLaw}>
                  <input type="hidden" name="track" value={track} /><input type="hidden" name="target" value={t.id} />
                  <input type="hidden" name="role" value={role} /><input type="hidden" name="law" value={g.law} />
                  <button className="us-btn-s">추가</button>
                </form>
              </td>
            </tr>
          ))}
          {!groups.length && <tr><td colSpan={5} className="c usb2-empty">찾은 법령이 없습니다</td></tr>}
        </tbody>
      </table>
    </Modal>
  );
}
