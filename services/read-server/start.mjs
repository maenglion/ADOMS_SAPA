import { spawn } from "node:child_process";

const port = process.env.PORT || "3100";
const nextBin = process.platform === "win32" ? "next.cmd" : "next";
const dnsOrderOption = "--dns-result-order=ipv4first";
const nodeOptions = process.env.NODE_OPTIONS || "";
const child = spawn(nextBin, ["start", "-p", port, "-H", "0.0.0.0"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    // Railway private DNS publishes IPv6 and IPv4. The PostgreSQL private
    // endpoint is materially faster and stable over IPv4 in this runtime.
    NODE_OPTIONS: nodeOptions.includes(dnsOrderOption)
      ? nodeOptions
      : `${nodeOptions} ${dnsOrderOption}`.trim(),
  },
  stdio: "inherit",
  shell: process.platform === "win32",
});

async function prewarm() {
  if (process.env.ADOMS_READ_SERVER_SERVICE !== "1") return;
  const token = process.env.ADOMS_READ_SERVER_TOKEN;
  if (!token) return;
  const base = `http://127.0.0.1:${port}`;
  const headers = { authorization: `Bearer ${token}` };
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`${base}/api/read-server/health`, { headers });
      if (response.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  for (const path of ["/?role=gm", "/actions?role=gm", "/duties/list?role=gm", "/evidence?role=gm", "/tasks?role=gm"]) {
    const started = Date.now();
    try {
      const response = await fetch(`${base}${path}`, { headers });
      await response.arrayBuffer();
      console.log(`[adoms-read-server-warm] ${path} status=${response.status} ms=${Date.now() - started}`);
    } catch (error) {
      console.error(`[adoms-read-server-warm] ${path} failed`, error);
      return;
    }
  }
  console.log("[adoms-read-server-warm] ready");
}

void prewarm();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
