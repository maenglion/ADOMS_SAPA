"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const CORE = new Set(["/", "/actions", "/duties/list", "/evidence", "/tasks"]);

function send(event: Record<string, unknown>) {
  void fetch("/api/demo-admin/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  });
}

export default function QaEventBeacon() {
  const pathname = usePathname() || "/";
  const search = useSearchParams();
  const role = search?.get("role") || "gm";
  useEffect(() => {
    if (!sessionStorage.getItem("adoms-demo-session")) {
      sessionStorage.setItem("adoms-demo-session", "1");
      send({ eventType: "demo_session_start", route: pathname, role });
    }
    if (!CORE.has(pathname)) return;
    const key = `${pathname}|${role}`;
    if (sessionStorage.getItem("adoms-qa-last-page") === key) return;
    sessionStorage.setItem("adoms-qa-last-page", key);
    send({ eventType: "page_visit", route: pathname, role });
  }, [pathname, role]);
  return null;
}
