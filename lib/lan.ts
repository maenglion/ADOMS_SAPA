import "server-only";
import os from "node:os";

/**
 * 이 PC 가 같은 와이파이에서 어떤 주소로 보이는지 찾는다. (2026-09-21)
 *
 * 휴대폰에서 현장 등록 화면(/m)에 들어오려면 `localhost` 가 아니라 **이 PC 의 랜 주소**가 필요하다.
 * 배포하지 않아도 같은 와이파이면 바로 붙는다.
 *
 * 우선순위
 *   ① 환경변수 `NEXT_PUBLIC_BASE_URL` (배포했거나 주소를 못 찾을 때 직접 지정)
 *   ② 랜 주소 자동 탐지 — 192.168.x · 172.x · 10.x 를 흔한 순서로 고른다
 *   ③ 못 찾으면 localhost
 */
export function lanBase(): { url: string; host: string; port: string; guessed: boolean } {
  const port = process.env.PORT || "3100";

  const fixed = process.env.NEXT_PUBLIC_BASE_URL;
  if (fixed) {
    const u = new URL(fixed);
    return { url: fixed.replace(/\/$/, ""), host: u.hostname, port: u.port || port, guessed: false };
  }

  const cands: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (ni.family !== "IPv4" || ni.internal) continue;
      // 가상 어댑터(WSL·Docker·VirtualBox)는 휴대폰에서 못 붙는다 — 뒤로 민다.
      const virt = /wsl|vethernet|docker|virtual|loopback|vmware/i.test(name);
      cands.push(`${virt ? "9" : "0"}|${ni.address}`);
    }
  }
  cands.sort((a, b) => {
    const [pa, aa] = a.split("|"), [pb, ba] = b.split("|");
    if (pa !== pb) return pa < pb ? -1 : 1;
    const rank = (ip: string) => (ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : 2);
    return rank(aa) - rank(ba);
  });

  const host = cands.length ? cands[0].split("|")[1] : "localhost";
  return { url: `http://${host}:${port}`, host, port, guessed: cands.length > 0 };
}
