"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ROLES } from "./RoleSwitch";
import { ROLE_LABEL } from "@/lib/roles";
import { canAccess, normRole } from "@/lib/perm";

/**
 * 로그인 사용자 — 이용자 고르기.
 * [캡처 v2] 09-23 사용자 지시: 「첫 번째 버전(원본)의 이용자 선택 방식이 좋다」 — 흰 바탕 둥근 고르기 칸에
 * 「총괄(중대재해예방과)」처럼 역할(소속)을 보인다(원본 RoleSwitch 와 같은 모양 · `.userbox select` 스타일).
 * 현장 모드에서도 보인다. 소속·이름은 목록 칸에 마우스를 올리면(title).
 */
export type Who = { dept: string; name: string; duty: string };

const ROLE_CHANGE_NOTICE_KEY = "adoms-role-change-notice";
const ROLE_CHANGE_NOTICE_MS = 4_000;

type RoleChangeNotice = {
  role: string;
  expiresAt: number;
};

function Inner({ who }: { who: Record<string, Who> }) {
  const router = useRouter();
  const sp = useSearchParams();
  const adomsRole = normRole(sp?.get("role"));
  const w = who[adomsRole];
  const [changedRole, setChangedRole] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(ROLE_CHANGE_NOTICE_KEY);
    if (!raw) return;

    try {
      const notice = JSON.parse(raw) as RoleChangeNotice;
      if (!notice.role || notice.expiresAt <= Date.now()) {
        window.sessionStorage.removeItem(ROLE_CHANGE_NOTICE_KEY);
        return;
      }
      setChangedRole(notice.role);
    } catch {
      window.sessionStorage.removeItem(ROLE_CHANGE_NOTICE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!changedRole) return;

    const raw = window.sessionStorage.getItem(ROLE_CHANGE_NOTICE_KEY);
    let expiresAt = Date.now() + ROLE_CHANGE_NOTICE_MS;
    if (raw) {
      try {
        const notice = JSON.parse(raw) as RoleChangeNotice;
        if (notice.role === changedRole && notice.expiresAt > Date.now()) {
          expiresAt = notice.expiresAt;
        }
      } catch {
        // 아래에서 현재 역할 기준의 새 만료 시각으로 대체한다.
      }
    }

    const timeout = window.setTimeout(() => {
      window.sessionStorage.removeItem(ROLE_CHANGE_NOTICE_KEY);
      setChangedRole(null);
    }, Math.max(0, expiresAt - Date.now()));

    return () => window.clearTimeout(timeout);
  }, [changedRole]);

  const closeRoleNotice = () => {
    window.sessionStorage.removeItem(ROLE_CHANGE_NOTICE_KEY);
    setChangedRole(null);
  };

  return (
    <>
      <span className="userme">
        <select
          value={adomsRole}
          aria-label="이용자 바꾸기"
          title={w ? `${w.dept} ${w.name}${w.duty ? " " + w.duty : ""}` : ""}
          onChange={(e) => {
            const nextRole = e.target.value;
            if (nextRole === adomsRole) return;
            window.dispatchEvent(new Event("adoms-role-change"));
            window.sessionStorage.setItem(ROLE_CHANGE_NOTICE_KEY, JSON.stringify({
              role: nextRole,
              expiresAt: Date.now() + ROLE_CHANGE_NOTICE_MS,
            } satisfies RoleChangeNotice));
            setChangedRole(nextRole);
            void fetch("/api/demo-admin/event", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ eventType: "role_change", from: adomsRole, to: nextRole, role: nextRole, route: location.pathname }),
              keepalive: true,
            });
            const keepCurrentPath = canAccess(nextRole, location.pathname);
            const p = keepCurrentPath
              ? new URLSearchParams(Array.from(sp?.entries() || []))
              : new URLSearchParams();
            p.set("role", nextRole);
            router.push(`${keepCurrentPath ? location.pathname : "/"}?${p.toString()}`);
          }}
        >
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </span>
      {changedRole && (
        <div className="us-modal-bg us-role-change-bg" role="presentation">
          <section className="us-modal us-role-change-modal" role="dialog" aria-modal="true" aria-labelledby="role-change-title">
            <div className="us-modal-h" id="role-change-title">사용자 유형 변경</div>
            <div className="us-modal-b us-role-change-body">
              <p>사용자 유형이 <strong>{ROLE_LABEL[changedRole] || changedRole}</strong>로 변경되었습니다.</p>
              <p className="us-muted">해당 사용자 권한에 맞춰 메뉴와 화면이 표시됩니다.</p>
              <button type="button" className="us-btn g" onClick={closeRoleNotice}>확인</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default function UserBox({ who }: { who: Record<string, Who> }) {
  return <Suspense fallback={null}><Inner who={who} /></Suspense>;
}
