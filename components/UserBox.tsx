"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ROLES } from "./RoleSwitch";
import { ROLE_LABEL } from "@/lib/roles";

/**
 * 로그인 사용자 — 이용자 고르기.
 * [캡처 v2] 09-23 사용자 지시: 「첫 번째 버전(원본)의 이용자 선택 방식이 좋다」 — 흰 바탕 둥근 고르기 칸에
 * 「총괄(중대재해예방과)」처럼 역할(소속)을 보인다(원본 RoleSwitch 와 같은 모양 · `.userbox select` 스타일).
 * 현장 모드에서도 보인다. 소속·이름은 목록 칸에 마우스를 올리면(title).
 */
export type Who = { dept: string; name: string; duty: string };

function Inner({ who }: { who: Record<string, Who> }) {
  const router = useRouter();
  const sp = useSearchParams();
  const role = sp?.get("role") || "gm";
  const w = who[role];
  const [changedRole, setChangedRole] = useState<string | null>(null);

  return (
    <>
      <span className="userme">
        <select
          value={role}
          aria-label="이용자 바꾸기"
          title={w ? `${w.dept} ${w.name}${w.duty ? " " + w.duty : ""}` : ""}
          onChange={(e) => {
            const nextRole = e.target.value;
            if (nextRole === role) return;
            setChangedRole(nextRole);
            void fetch("/api/demo-admin/event", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ eventType: "role_change", from: role, to: nextRole, role: nextRole, route: location.pathname }),
              keepalive: true,
            });
            const p = new URLSearchParams(Array.from(sp?.entries() || []));
            p.set("role", nextRole);
            router.push(`?${p.toString()}`);
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
              <p>사용자가 <strong>{ROLE_LABEL[changedRole] || changedRole}</strong>으로 변경되었습니다.</p>
              <p className="us-muted">해당 사용자 권한에 맞춰 메뉴와 화면이 표시됩니다.</p>
              <button type="button" className="us-btn g" onClick={() => setChangedRole(null)}>확인</button>
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
