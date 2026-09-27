import { spawn } from "node:child_process";

const port = process.env.PORT || "3100";
const nextBin = process.platform === "win32" ? "next.cmd" : "next";
const child = spawn(nextBin, ["start", "-p", port, "-H", "0.0.0.0"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
