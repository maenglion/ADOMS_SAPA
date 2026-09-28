"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { withAdomsRole } from "@/lib/adoms-role";
import { isRole, normRole } from "@/lib/perm";

/** 모든 일반 내부 링크가 현재 ADOMS 역할을 잃지 않게 하는 공통 navigation 경계. */
export default function AdomsRoleNavigation() {
  const router = useRouter();
  const params = useSearchParams();
  const explicitRole = params.get("role");
  const role = normRole(explicitRole);

  useEffect(() => {
    if (!isRole(explicitRole)) return;
    void fetch("/api/adoms-role", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: explicitRole }),
      keepalive: true,
    });
  }, [explicitRole]);

  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const raw = anchor.getAttribute("href") || "";
      if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/api/") || raw.startsWith("/demo-admin")) return;
      const next = withAdomsRole(raw, role);
      if (next === raw) return;
      event.preventDefault();
      event.stopPropagation();
      router.push(next);
    };
    document.addEventListener("click", navigate, true);
    return () => document.removeEventListener("click", navigate, true);
  }, [role, router]);

  return null;
}
