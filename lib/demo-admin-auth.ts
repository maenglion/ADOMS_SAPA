import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** QA/service 관리자 인증. ADOMS 사용자 역할(adoms-role)과 완전히 별개다. */
export const SERVICE_ADMIN_COOKIE = "adoms-service-admin";
const SESSION_SECONDS = 3 * 60 * 60;

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionSecret(): string {
  return (process.env.ADOMS_DEMO_ADMIN_SESSION_SECRET || "").trim();
}

export function adminAuthConfigured(): boolean {
  return Boolean(
    (process.env.ADOMS_DEMO_ADMIN_USER || "").trim()
    && process.env.ADOMS_DEMO_ADMIN_PASSWORD
    && sessionSecret(),
  );
}

export function validAdminCredentials(user: string, password: string): boolean {
  const expectedUser = (process.env.ADOMS_DEMO_ADMIN_USER || "").trim();
  const expectedPassword = process.env.ADOMS_DEMO_ADMIN_PASSWORD || "";
  if (!expectedUser || !expectedPassword || !sessionSecret()) return false;
  return safeEqual(user, expectedUser) && safeEqual(password, expectedPassword);
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createAdminSession(): string {
  const payload = `${Math.floor(Date.now() / 1000) + SESSION_SECONDS}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function validAdminSession(value: string | undefined): boolean {
  if (!value || !sessionSecret()) return false;
  const match = value.match(/^(\d+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!match) return false;
  const payload = `${match[1]}.${match[2]}`;
  if (!safeEqual(match[3], sign(payload))) return false;
  return Number(match[1]) > Math.floor(Date.now() / 1000);
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NETLIFY === "true" || Boolean(process.env.URL),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}
