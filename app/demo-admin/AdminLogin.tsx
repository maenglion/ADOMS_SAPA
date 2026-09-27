"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/demo-admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "로그인에 실패했습니다.");
      setPassword("");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="qa-login-shell">
      <form className="qa-login-card" onSubmit={submit}>
        <div className="qa-brand">ADOMS</div>
        <h1>시연 QA 로그인</h1>
        <p>시연 상태와 오류 기록을 확인하는 내부 점검 화면입니다.</p>
        <label>아이디<input autoComplete="username" value={user} onChange={(event) => setUser(event.target.value)} required /></label>
        <label>비밀번호
          <span className="qa-password">
            <input type={visible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button type="button" aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"} onClick={() => setVisible((value) => !value)}>
              {visible ? "◉" : "○"}
            </button>
          </span>
        </label>
        {error && <div className="qa-error" role="alert">{error}</div>}
        <button className="qa-primary" type="submit" disabled={busy}>{busy ? "확인 중..." : "로그인"}</button>
      </form>
    </main>
  );
}
