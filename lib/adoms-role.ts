import { isRole, type Role } from "./perm";

export const ADOMS_ROLE_COOKIE = "adoms-role";
export const ADOMS_ROLE_MAX_AGE = 60 * 60 * 24;

/** 내부 ADOMS 주소에 현재 역할을 합친다. 기존 query와 hash는 보존한다. */
export function withAdomsRole(href: string, role: string): string {
  if (!isRole(role) || !href || href.startsWith("#")) return href;
  let url: URL;
  try {
    url = new URL(href, "https://adoms.local");
  } catch {
    return href;
  }
  if (url.origin !== "https://adoms.local" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/demo-admin")) return href;
  url.searchParams.set("role", role);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function roleRedirectPath(role: Role): string {
  return withAdomsRole("/", role);
}
