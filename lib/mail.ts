/**
 * 전자우편 보내기 — 아주 작은 SMTP 클라이언트(09-25 사용자: 「메일 발송은 포함하자」).
 * 새 패키지를 넣지 않고 Node 기본 모듈(net · tls)만 쓴다.
 *
 * 설정 = 환경 변수(값은 화면에 보이지 않는다 · 비밀번호는 어디에도 기록하지 않는다)
 *   SMTP_HOST   메일 서버 주소(필수)                     예: smtp.example.go.kr
 *   SMTP_PORT   포트(기본 587 · 465 면 처음부터 암호화)
 *   SMTP_SECURE "true" = 처음부터 암호화(465). 아니면 서버가 STARTTLS 를 알리면 암호화로 바꾼다
 *   SMTP_USER · SMTP_PASS  로그인(기관 내부 중계 서버처럼 로그인이 없으면 비워 둔다)
 *   MAIL_FROM   발신 주소(필수)                           예: safety@example.go.kr
 *   MAIL_FROM_NAME  발신 이름(기본 「용인특례시 중대재해 통합관리」)
 *   SMTP_TLS_REJECT_UNAUTHORIZED "false" = 기관 내부 인증서(자체 서명)를 받아들인다(기본은 검증)
 *   SMTP_ALLOW_PLAIN_AUTH "true" = 암호화 안 된 연결에서도 로그인(기본은 거부 — 비밀번호가 평문으로 나간다)
 * SMTP_HOST 와 MAIL_FROM 이 없으면 **보내지 않는다** — lib/channels.ts 가 「발송 대기(메일 서버 설정 필요)」로 기록한다.
 */
import "server-only";
import net from "node:net";
import tls from "node:tls";
import os from "node:os";

export type MailConfig = {
  ready: boolean; host: string; port: number; secure: boolean;
  user: string; pass: string; from: string; fromName: string;
  rejectUnauthorized: boolean; allowPlainAuth: boolean;
  missing: string[];
};

export function mailConfig(): MailConfig {
  const e = process.env;
  const host = String(e.SMTP_HOST || "").trim();
  const port = Number(e.SMTP_PORT || 0) || (String(e.SMTP_SECURE) === "true" ? 465 : 587);
  const secure = String(e.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const from = String(e.MAIL_FROM || e.SMTP_USER || "").trim();
  const missing = [...(host ? [] : ["SMTP_HOST"]), ...(from ? [] : ["MAIL_FROM"])];
  return {
    ready: missing.length === 0, host, port, secure,
    user: String(e.SMTP_USER || ""), pass: String(e.SMTP_PASS || ""),
    from, fromName: String(e.MAIL_FROM_NAME || "용인특례시 중대재해 통합관리"),
    rejectUnauthorized: String(e.SMTP_TLS_REJECT_UNAUTHORIZED || "").toLowerCase() !== "false",
    allowPlainAuth: String(e.SMTP_ALLOW_PLAIN_AUTH || "").toLowerCase() === "true",
    missing,
  };
}

/** 화면에 보여도 되는 것만(비밀번호 · 로그인 이름은 「있음/없음」만) */
export function mailConfigView() {
  const c = mailConfig();
  return {
    ready: c.ready, host: c.host, port: c.host ? c.port : "", secure: c.secure ? "처음부터 암호화(SMTPS)" : "STARTTLS(서버가 알리면 암호화)",
    from: c.from, fromName: c.fromName, login: c.user ? "있음" : "없음", pass: c.pass ? "설정됨" : "없음",
    verify: c.rejectUnauthorized ? "검증함" : "검증 안 함(기관 내부 인증서)", missing: c.missing,
  };
}

/* ── 보내기 ─────────────────────────────────────────────── */

const clean = (s: string) => String(s || "").replace(/[\r\n]+/g, " ").trim();
const addrOk = (a: string) => /^[^\s<>@,;"]+@[^\s<>@,;"]+\.[^\s<>@,;"]+$/.test(a);
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const encWord = (s: string) => `=?UTF-8?B?${b64(clean(s))}?=`;
const wrap76 = (s: string) => s.replace(/.{1,76}/g, (x) => x + "\r\n");

function buildMessage(c: MailConfig, to: { addr: string; name?: string }, subject: string, text: string) {
  const d = new Date();
  const id = `<${d.getTime().toString(36)}.${Math.random().toString(36).slice(2)}@${c.from.split("@")[1] || "localhost"}>`;
  const head = [
    `From: ${encWord(c.fromName)} <${c.from}>`,
    `To: ${to.name ? encWord(to.name) + " " : ""}<${to.addr}>`,
    `Subject: ${encWord(subject)}`,
    `Date: ${d.toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: ${id}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ].join("\r\n");
  return `${head}\r\n\r\n${wrap76(b64(text.replace(/\r?\n/g, "\r\n")))}`;
}

type Reply = { code: number; text: string };

/** SMTP 응답 읽기 — 여러 줄 응답(250-…)을 한 덩어리로 모은다. */
class Wire {
  private buf = "";
  private lines: string[] = [];
  private waiters: ((r: Reply | Error) => void)[] = [];
  private ready: Reply[] = [];
  private sock!: net.Socket;
  private onData = (d: Buffer) => { this.buf += d.toString("utf8"); this.pump(); };
  private onErr = (e: Error) => this.fail(e);
  private onClose = () => this.fail(new Error("메일 서버가 연결을 끊었습니다"));
  attach(s: net.Socket) {
    if (this.sock) { this.sock.off("data", this.onData); this.sock.off("error", this.onErr); this.sock.off("close", this.onClose); }
    this.sock = s;
    s.on("data", this.onData); s.on("error", this.onErr); s.on("close", this.onClose);
    s.setTimeout(20000, () => { this.fail(new Error("메일 서버 응답 시간 초과")); s.destroy(); });
  }
  private pump() {
    let i: number;
    while ((i = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, i).replace(/\r$/, "");
      this.buf = this.buf.slice(i + 1);
      this.lines.push(line);
      if (/^\d{3}(?: |$)/.test(line)) {
        const r = { code: Number(line.slice(0, 3)), text: this.lines.join("\n") };
        this.lines = [];
        const w = this.waiters.shift();
        if (w) w(r); else this.ready.push(r);
      }
    }
  }
  private fail(e: Error) { const ws = this.waiters.splice(0); ws.forEach((w) => w(e)); }
  read(): Promise<Reply> {
    const r = this.ready.shift();
    if (r) return Promise.resolve(r);
    return new Promise((ok, no) => this.waiters.push((x) => (x instanceof Error ? no(x) : ok(x))));
  }
  write(s: string) { this.sock.write(s + "\r\n"); }
  get socket() { return this.sock; }
}

async function expect(w: Wire, want: number[], what: string): Promise<Reply> {
  const r = await w.read();
  if (!want.includes(r.code)) throw new Error(`${what} 실패(${r.code} ${clean(r.text).slice(0, 80)})`);
  return r;
}
async function cmd(w: Wire, line: string, want: number[], what: string) { w.write(line); return expect(w, want, what); }

function connect(c: MailConfig): Promise<net.Socket> {
  return new Promise((ok, no) => {
    const s = c.secure
      ? tls.connect({ host: c.host, port: c.port, servername: c.host, rejectUnauthorized: c.rejectUnauthorized }, () => ok(s))
      : net.connect({ host: c.host, port: c.port }, () => ok(s));
    s.once("error", no);
    s.setTimeout(20000, () => { s.destroy(); no(new Error("메일 서버에 연결하지 못했습니다(시간 초과)")); });
  });
}
function upgrade(c: MailConfig, raw: net.Socket): Promise<tls.TLSSocket> {
  return new Promise((ok, no) => {
    const s = tls.connect({ socket: raw, servername: c.host, rejectUnauthorized: c.rejectUnauthorized }, () => ok(s));
    s.once("error", no);
  });
}

/**
 * 한 사람에게 한 통 보낸다(받는 사람끼리 주소가 보이지 않게 한 통씩).
 * 설정이 없으면 부르지 않는다 — 부르면 오류.
 */
export async function sendMail(to: { addr: string; name?: string }, subject: string, text: string): Promise<void> {
  const c = mailConfig();
  if (!c.ready) throw new Error("메일 서버 설정 필요");
  const addr = clean(to.addr);
  if (!addrOk(addr) || !addrOk(c.from)) throw new Error("전자우편 주소 형식이 맞지 않습니다");
  const w = new Wire();
  let sock: net.Socket = await connect(c);
  w.attach(sock);
  let secure = c.secure;
  try {
    await expect(w, [220], "연결");
    const me = clean(os.hostname() || "localhost").replace(/[^A-Za-z0-9.-]/g, "") || "localhost";
    let ehlo = await cmd(w, `EHLO ${me}`, [250], "인사(EHLO)");
    if (!secure && /STARTTLS/i.test(ehlo.text)) {
      await cmd(w, "STARTTLS", [220], "암호화 전환(STARTTLS)");
      sock = await upgrade(c, sock);
      w.attach(sock);
      secure = true;
      ehlo = await cmd(w, `EHLO ${me}`, [250], "인사(EHLO)");
    }
    if (c.user) {
      if (!secure && !c.allowPlainAuth) throw new Error("암호화되지 않은 연결이라 로그인하지 않았습니다(SMTP_ALLOW_PLAIN_AUTH)");
      if (/AUTH[^\n]*PLAIN/i.test(ehlo.text)) {
        await cmd(w, `AUTH PLAIN ${b64(`\u0000${c.user}\u0000${c.pass}`)}`, [235], "로그인");
      } else {
        await cmd(w, "AUTH LOGIN", [334], "로그인");
        await cmd(w, b64(c.user), [334], "로그인");
        await cmd(w, b64(c.pass), [235], "로그인");
      }
    }
    await cmd(w, `MAIL FROM:<${c.from}>`, [250], "발신 주소");
    await cmd(w, `RCPT TO:<${addr}>`, [250, 251], "받는 주소");
    await cmd(w, "DATA", [354], "본문 시작");
    // 본문은 base64 라 줄 첫 글자가 「.」일 수 없다(점 두 번 쓰기 불필요) — 머리글 줄만 확인
    const msg = buildMessage(c, { addr, name: to.name }, subject, text).replace(/\r\n\./g, "\r\n..");
    w.socket.write(msg + "\r\n.\r\n");
    await expect(w, [250], "보내기");
    try { await cmd(w, "QUIT", [221], "끝"); } catch {}
  } finally {
    try { w.socket.end(); } catch {}
  }
}
