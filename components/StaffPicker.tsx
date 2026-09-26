"use client";
import { useEffect, useMemo, useState } from "react";

/**
 * 직원 검색 창 — 참고 명세의 「🔍 직원 검색」. (2026-09-21)
 * 폼 안에 숨은 칸(name)을 두고, 창에서 고른 사람의 staff_id 를 거기 넣는다.
 * 드롭다운 대신 창을 쓰는 이유: 직원이 수십~수백 명이면 드롭다운에서 찾을 수 없다. 이름·부서·역할로 거른다.
 */
export type StaffOpt = { staff_id: string; display_name: string; dept_name: string; duty_role: string };

export default function StaffPicker({ name, staff, defaultValue = "", label = "담당", allowEmpty = false }:
  { name: string; staff: StaffOpt[]; defaultValue?: string; label?: string; allowEmpty?: boolean }) {
  const [val, setVal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const cur = staff.find((s) => s.staff_id === val);

  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open]);

  const hits = useMemo(() => {
    const k = q.trim();
    return k ? staff.filter((s) => `${s.display_name} ${s.dept_name} ${s.duty_role}`.includes(k)) : staff;
  }, [q, staff]);

  return (
    <>
      <input type="hidden" name={name} value={val} />
      <span className="spick">
        <span className="spick-cur">{cur ? <><b>{cur.display_name}</b> <span className="muted">{cur.dept_name} · {cur.duty_role}</span></>
                                         : <span className="muted">지정 안 됨</span>}</span>
        <button type="button" className="btn ghost sm" onClick={() => { setQ(""); setOpen(true); }}>🔍 {label} 찾기</button>
      </span>

      {open && (
        <div className="lbox" onClick={() => setOpen(false)} role="dialog" aria-label={`${label} 찾기`}>
          <div className="spick-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <b>{label} 찾기</b>
              <input autoFocus type="text" value={q} onChange={(e) => setQ(e.target.value)}
                     placeholder="이름 · 부서 · 역할" style={{ flex: 1 }} />
              <button type="button" className="btn sm" onClick={() => setOpen(false)}>닫기</button>
            </div>
            <div className="tbl-wrap" style={{ maxHeight: 380, marginTop: 10 }}>
              <table>
                <thead><tr><th>이름</th><th>부서</th><th style={{ width: 110 }}>역할</th><th style={{ width: 70 }} /></tr></thead>
                <tbody>
                  {allowEmpty && (
                    <tr><td colSpan={3} className="muted">지정하지 않음</td>
                      <td><button type="button" className="btn ghost sm" onClick={() => { setVal(""); setOpen(false); }}>선택</button></td></tr>
                  )}
                  {hits.map((s) => (
                    <tr key={s.staff_id} style={{ background: s.staff_id === val ? "var(--blush)" : undefined }}>
                      <td><b>{s.display_name}</b></td>
                      <td>{s.dept_name}</td>
                      <td className="muted">{s.duty_role}</td>
                      <td><button type="button" className="btn ghost sm" onClick={() => { setVal(s.staff_id); setOpen(false); }}>선택</button></td>
                    </tr>
                  ))}
                  {!hits.length && <tr><td colSpan={4} className="muted">찾는 사람이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ margin: "8px 0 0" }}>{hits.length}명 · Esc 로 닫기</p>
          </div>
        </div>
      )}
    </>
  );
}
