"use client";
import { resetInputs } from "./actions";

/** 확인을 한 번 더 받고 지운다 — 되돌릴 수 없다. */
export default function ResetButton({ role, n }: { role: string; n: number }) {
  return (
    <form action={resetInputs}
          onSubmit={(e) => { if (!confirm(`화면에서 입력한 기록 ${n}건을 모두 지우고 처음 상태로 되돌립니다. 되돌릴 수 없습니다. 계속할까요?`)) e.preventDefault(); }}>
      <input type="hidden" name="role" value={role} />
      <button className="btn ghost" type="submit" disabled={n === 0}>화면 입력 모두 지우기</button>
    </form>
  );
}
