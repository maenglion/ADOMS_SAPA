"use client";
import { useEffect, useMemo, useState } from "react";
import { CODE_GROUPS, CITIZEN_DETAIL, type FixItem } from "./codes";

/**
 * 신고 접수 창에서 쓰는 입력 조각들. (2026-09-21)
 *   AssetPicker — 시설(관리대상 대장) 검색 창. 고르면 숨은 칸(asset_id·이름·구분·종별·부서)이 채워진다.
 *   CodePicker  — 분류군(시설물 안전 / 이용자 안전) → 분류 코드.
 *   ChannelPicker — 접수 경로, 시민 신고면 세부 경로(120·안전신문고·응답소).
 *   FixRows     — 보수·보강 계획 표(항목·물량·비용·기간), 줄을 더하고 뺀다.
 */
export type AssetOpt = { asset_id: string; asset_name: string; asset_gbn: string; asset_class: string; dept_id: string; dept_name: string };

export function AssetPicker({ assets, defaultId = "" }: { assets: AssetOpt[]; defaultId?: string }) {
  const [val, setVal] = useState(defaultId);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [gbn, setGbn] = useState("");
  const cur = assets.find((a) => a.asset_id === val);
  const gbns = useMemo(() => [...new Set(assets.map((a) => a.asset_gbn))].filter(Boolean), [assets]);

  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open]);

  const hits = useMemo(() => {
    const k = q.trim();
    return assets.filter((a) => (!gbn || a.asset_gbn === gbn) && (!k || `${a.asset_name} ${a.asset_id} ${a.dept_name}`.includes(k))).slice(0, 200);
  }, [q, gbn, assets]);

  return (
    <>
      <input type="hidden" name="asset_id" value={cur?.asset_id || ""} />
      <input type="hidden" name="asset_name" value={cur?.asset_name || ""} />
      <input type="hidden" name="asset_gbn" value={cur?.asset_gbn || ""} />
      <input type="hidden" name="asset_class" value={cur?.asset_class || ""} />
      <input type="hidden" name="dept_id" value={cur?.dept_id || ""} />
      <span className="spick">
        <span className="spick-cur">{cur
          ? <><b>{cur.asset_name}</b> <span className="muted">{cur.asset_gbn} · {cur.asset_class || "종별 없음"} · {cur.dept_name}</span></>
          : <span className="muted">시설을 고르지 않았습니다</span>}</span>
        <button type="button" className="btn ghost sm us-search-btn" onClick={() => { setQ(""); setOpen(true); }}>시설 찾기</button>
      </span>
      {open && (
        <div className="lbox" onClick={() => setOpen(false)} role="dialog" aria-label="시설 찾기">
          <div className="spick-box" style={{ width: "min(760px,94vw)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b>시설 찾기</b>
              <input autoFocus type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="시설 이름 · 번호 · 부서" style={{ flex: 1, minWidth: 200 }} />
              <select value={gbn} onChange={(e) => setGbn(e.target.value)}>
                <option value="">모든 구분</option>
                {gbns.map((g) => <option key={g}>{g}</option>)}
              </select>
              <button type="button" className="btn sm" onClick={() => setOpen(false)}>닫기</button>
            </div>
            <div className="tbl-wrap" style={{ maxHeight: 400, marginTop: 10 }}>
              <table>
                <thead><tr><th>시설</th><th className="cd">구분</th><th className="cd">종별</th><th>관리 부서</th><th style={{ width: 70 }} /></tr></thead>
                <tbody>
                  {hits.map((a) => (
                    <tr key={a.asset_id} style={{ background: a.asset_id === val ? "var(--blush)" : undefined }}>
                      <td><b>{a.asset_name}</b><div className="muted">{a.asset_id}</div></td>
                      <td className="cd">{a.asset_gbn}</td>
                      <td className="cd">{a.asset_class || "—"}</td>
                      <td>{a.dept_name}</td>
                      <td><button type="button" className="btn ghost sm" onClick={() => { setVal(a.asset_id); setOpen(false); }}>선택</button></td>
                    </tr>
                  ))}
                  {!hits.length && <tr><td colSpan={5} className="muted">찾는 시설이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ margin: "8px 0 0" }}>{hits.length >= 200 ? "앞 200곳만 보입니다 — 이름으로 좁혀 보십시오" : `${hits.length}곳`} · Esc 로 닫기</p>
          </div>
        </div>
      )}
    </>
  );
}

export function CodePicker() {
  const [g, setG] = useState("이용자 안전");
  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      <select name="code_group" value={g} onChange={(e) => setG(e.target.value)}>
        {Object.keys(CODE_GROUPS).map((k) => <option key={k}>{k}</option>)}
      </select>
      <select name="code" key={g}>
        {CODE_GROUPS[g].map((c) => <option key={c}>{c}</option>)}
      </select>
    </span>
  );
}

export function ChannelPicker({ channels }: { channels: readonly string[] }) {
  const [c, setC] = useState(channels[0]);
  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      <select name="channel" value={c} onChange={(e) => setC(e.target.value)}>
        {channels.map((x) => <option key={x}>{x}</option>)}
      </select>
      {c === "시민 신고" && (
        <select name="channel_detail" defaultValue="120">
          {CITIZEN_DETAIL.map((x) => <option key={x}>{x}</option>)}
        </select>
      )}
    </span>
  );
}

export function FixRows({ initial }: { initial: FixItem[] }) {
  const start = initial.length ? initial : [{ item: "", qty: "", cost: "", period: "" }];
  const [rows, setRows] = useState(start.map((r, i) => ({ ...r, k: `r${i}` })));
  const [n, setN] = useState(start.length);
  const total = rows.reduce((a, r) => a + (parseFloat(String(r.cost).replace(/,/g, "")) || 0), 0);
  return (
    <>
      <input type="hidden" name="row_keys" value={rows.map((r) => r.k).join(",")} />
      <table>
        <thead><tr><th>개선 항목</th><th style={{ width: 120 }}>물량</th><th style={{ width: 130 }}>비용(만원)</th><th style={{ width: 150 }}>기간</th><th style={{ width: 50 }} /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td><input type="text" name={`item_${r.k}`} defaultValue={r.item} placeholder="예: 균열 보수(에폭시 주입)" style={{ width: "100%" }} /></td>
              <td><input type="text" name={`qty_${r.k}`} defaultValue={r.qty} placeholder="35m" style={{ width: "100%" }} /></td>
              <td><input type="text" name={`cost_${r.k}`} defaultValue={r.cost} placeholder="2600" style={{ width: "100%" }}
                         onChange={(e) => setRows(rows.map((x) => (x.k === r.k ? { ...x, cost: e.target.value } : x)))} /></td>
              <td><input type="text" name={`period_${r.k}`} defaultValue={r.period} placeholder="2026-10~11" style={{ width: "100%" }} /></td>
              <td>{rows.length > 1 && <button type="button" className="btn ghost sm" onClick={() => setRows(rows.filter((x) => x.k !== r.k))}>빼기</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
        <button type="button" className="btn ghost sm" onClick={() => { setRows([...rows, { item: "", qty: "", cost: "", period: "", k: `r${n}` }]); setN(n + 1); }}>+ 줄 더하기</button>
        <span className="muted">비용 합계 <b>{total.toLocaleString()}</b>만원</span>
      </div>
    </>
  );
}
