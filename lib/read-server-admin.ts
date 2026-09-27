import "server-only";

function readServerBaseUrl(): URL {
  const raw = (process.env.ADOMS_READ_SERVER_URL || "").trim();
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("READ server URL is not configured safely.");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url;
}

export async function callReadServer(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (process.env.ADOMS_READ_SERVER_TOKEN || "").trim();
  if (!token) throw new Error("READ server token is not configured.");
  const target = new URL(path, readServerBaseUrl());
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(target, { ...init, headers, cache: "no-store" });
}
