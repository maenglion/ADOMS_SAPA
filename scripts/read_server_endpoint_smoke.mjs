const baseArg = process.argv.find((value) => value.startsWith("--base="));
const baseRaw = baseArg?.slice("--base=".length) || process.env.ADOMS_READ_SERVER_URL || "";
const token = process.env.ADOMS_READ_SERVER_TOKEN || "";

if (!baseRaw || !token) {
  console.error("ADOMS_READ_SERVER_URL (or --base) and ADOMS_READ_SERVER_TOKEN are required.");
  process.exit(2);
}

const base = new URL(baseRaw);
const auth = { authorization: `Bearer ${token}` };
let failures = 0;

async function check(name, path, init, expectedStatus) {
  const response = await fetch(new URL(path, base), { ...init, redirect: "manual", cache: "no-store" });
  const location = response.headers.get("location");
  const passed = response.status === expectedStatus && !location;
  console.log(JSON.stringify({ name, status: response.status, redirect: location || null, passed }));
  if (!passed) failures += 1;
  return response;
}

await check("health rejects missing service auth", "/api/read-server/health", {}, 401);
await check("health is ready without role redirect", "/api/read-server/health", { headers: auth }, 200);
await check("cache control rejects missing service auth", "/api/read-server/control/cache-reset", { method: "POST" }, 401);
await check("QA endpoint rejects missing service auth", "/api/read-server/qa/events", {}, 401);
await check("QA endpoint accepts service auth", "/api/read-server/qa/events", { headers: auth }, 200);

if (process.argv.includes("--reset-cache")) {
  await check("cache control accepts service auth and completes prewarm", "/api/read-server/control/cache-reset", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: "{}",
  }, 200);
  await check("health returns ready after cache prewarm", "/api/read-server/health", { headers: auth }, 200);
}

if (failures) {
  console.error(`READ server endpoint smoke failed: ${failures}`);
  process.exit(1);
}
console.log("READ server endpoint smoke PASS");
