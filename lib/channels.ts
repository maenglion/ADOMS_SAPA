/**
 * [400 · 교육자료 버전] 발신 수단 한 곳 (2026-09-24) — 앱 알림 · 문자 · 전자우편 · 카카오톡을 **같은 모양**으로 부른다.
 * (3300 의 lib/channels.ts 와 같은 구조. 이행현황 「메시지 보내기」(app/status/actions.ts sendOrder)가 이 파일을 거쳐 보낸다.)
 *
 * 지금 실제로 도는 것은 「앱 알림」(= notification 표에 받는 사람마다 한 줄, 받는 사람의 「내 업무」·대시보드 알림에 뜬다) 하나다.
 * 문자·카카오톡은 연결 설정이 없어 **아무것도 밖으로 보내지 않는다** — 발신 기록에 「미발송(연결 준비 중)」으로만 남긴다.
 * 09-25 사용자: 전자우편은 실제로 보낼 수 있게 했다(lib/mail.ts). 단 메일 서버 설정(환경 변수)이 없으면 보내지 않고
 *   「발송 대기(메일 서버 설정 필요)」로 기록한다. 설정 방법은 lib/mail.ts 머리 · 시스템 관리 › 메일 설정 화면.
 *
 * ── 나중에 실제로 연결할 때(확장 지점) ─────────────────────────────
 *   이 파일만 바꾼다. 화면(app/status)과 발신 기록(usa_order)은 그대로 둔다.
 *   1) 해당 수단의 `ready` 를 연결 설정(환경 변수 등)이 있을 때 true 가 되게 바꾼다.
 *      예: sms   — SMS_API_URL · SMS_API_KEY · SMS_SENDER(발신 번호)
 *          email — SMTP_HOST · SMTP_USER · SMTP_PASS · MAIL_FROM
 *          kakao — KAKAO_BIZ_KEY · KAKAO_SENDER_KEY · KAKAO_TEMPLATE_CODE(알림톡 템플릿 승인 필요)
 *   2) `notReady(...)` 자리에 그 수단의 `send(msg)` 를 구현해 넣는다.
 *      받는 사람의 연락처는 `Recipient.phone` · `Recipient.email` 로 들어온다(직원 명부 staff 의 phone·email).
 *   3) 결과는 `SendResult` 로 돌려준다 — 발신 기록의 수단별 결과 글자가 여기서 만들어진다.
 *   ★ 외부 발송은 개인정보(연락처)를 밖으로 내보내는 일이다 — 연결 전에 기관의 승인·동의 절차를 거친다.
 */
import "server-only";
import { appendRow } from "@/lib/write";
import { readTable, type Row } from "@/lib/data";
import { ymd } from "@/lib/day";
import { mailConfig, sendMail } from "@/lib/mail";

export type Channel = "app" | "sms" | "email" | "kakao";

export type Recipient = {
  staff_id: string; name: string; dept_id: string; dept_name: string;
  email?: string; phone?: string;
};

/** 보낼 메시지 한 건 — 수단이 달라도 같은 모양. */
export type OutMessage = {
  msg_id: string;           // 발신 기록 번호(usa_order.order_id)
  notif_type: string;       // 알림 종류(예: 「조치 지시」)
  from_staff_id: string;
  from_name: string;
  body: string;             // 메시지 본문
  to: Recipient[];
};

export type SendResult = {
  channel: Channel; label: string;
  ok: boolean;              // 실제로 보냈는가
  count: number;            // 보낸 수
  status: string;           // 기록에 남길 글자(예: 「발송 2건」 · 「미발송(연결 준비 중)」)
};

export interface Sender {
  channel: Channel;
  label: string;
  ready: boolean;           // 연결되어 실제로 보낼 수 있는가
  send(msg: OutMessage): Promise<SendResult>;
}

const newId = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

/**
 * 앱 알림 한 줄의 `note` — 발신 기록과 알림을 잇는 고리.
 * 3400 이 전부터 쓰던 모양(「이행현황 조치 지시 {번호}」)을 그대로 써서, 전에 보낸 기록도 읽음 수가 이어진다.
 */
export const noteOf = (msg_id: string) => `이행현황 조치 지시 ${msg_id}`;

/** 앱 알림 — notification 표에 받는 사람마다 한 줄. */
const appSender: Sender = {
  channel: "app", label: "앱 알림", ready: true,
  async send(msg) {
    let n = 0;
    for (const r of msg.to) {
      await appendRow("notification", {
        notif_id: newId("NTF"), task_id: "", notif_type: msg.notif_type,
        to_staff_id: r.staff_id, from_staff_id: msg.from_staff_id, sent_at: ymd(),
        message: `[${msg.notif_type}] ${msg.body}`,
        read_at: "", note: noteOf(msg.msg_id),
      }, msg.from_staff_id, `${msg.notif_type} 알림`);
      n++;
    }
    return { channel: "app", label: "앱 알림", ok: n > 0, count: n, status: `발송 ${n}건` };
  },
};

/**
 * 전자우편 — 09-25 사용자: 「메일 발송은 포함하자」. lib/mail.ts(Node 기본 모듈만 쓰는 작은 SMTP 클라이언트)로 보낸다.
 *  · 메일 서버 설정(SMTP_HOST · MAIL_FROM …)이 없으면 **보내지 않고** 「발송 대기(메일 서버 설정 필요)」로 기록한다.
 *  · 받는 사람마다 한 통씩(서로 주소가 보이지 않게). 전자우편 주소가 없는 사람은 건너뛰고 기록에 남긴다.
 *  · 한 통 한 통을 발송 기록 표 sys_mail_log 에 남긴다 — 시스템 관리 › 메일 설정 화면이 최근 기록을 보여 준다.
 */
export const MAIL_LOG = "sys_mail_log";
const mailSubject = (msg: OutMessage) => `[용인특례시 중대재해 통합관리] ${msg.notif_type}`;
const mailBody = (msg: OutMessage, r: Recipient) =>
  `${r.dept_name ? r.dept_name + " " : ""}${r.name} 님\n\n${msg.body}\n\n보낸 사람: ${msg.from_name}\n알림 번호: ${msg.msg_id}\n\n※ 이 메일은 용인특례시 중대재해 통합관리시스템에서 보냈습니다. 자세한 내용은 시스템의 「내 업무」에서 확인하세요.`;
const stamp = () => new Date().toISOString();
const emailSender: Sender = {
  channel: "email", label: "전자우편", ready: mailConfig().ready,
  async send(msg) {
    const cfg = mailConfig();
    let sent = 0, wait = 0, noAddr = 0, fail = 0, lastErr = "";
    for (const r of msg.to) {
      const addr = String(r.email || "").trim();
      let status: string, error = "";
      if (!addr) { status = "미발송(전자우편 주소 없음)"; noAddr++; }
      else if (!cfg.ready) { status = "발송 대기(메일 서버 설정 필요)"; wait++; }
      else {
        try { await sendMail({ addr, name: r.name }, mailSubject(msg), mailBody(msg, r)); status = "발송"; sent++; }
        catch (e: any) { error = String(e?.message || e).slice(0, 120); status = "실패"; fail++; lastErr = error; }
      }
      await appendRow(MAIL_LOG, {
        mail_id: newId("MAIL"), msg_id: msg.msg_id, at: stamp(), notif_type: msg.notif_type,
        from_staff_id: msg.from_staff_id, to_staff_id: r.staff_id, to_name: r.name, to_dept: r.dept_name, to_email: addr,
        subject: mailSubject(msg), status, error,
      }, msg.from_staff_id, `전자우편 ${status}`);
    }
    const parts = [
      ...(sent ? [`발송 ${sent}건`] : []),
      ...(wait ? [`발송 대기(메일 서버 설정 필요) ${wait}건`] : []),
      ...(fail ? [`실패 ${fail}건(${lastErr.slice(0, 40)})`] : []),
      ...(noAddr ? [`주소 없음 ${noAddr}건`] : []),
    ];
    return { channel: "email", label: "전자우편", ok: sent > 0, count: sent, status: parts.join(" · ") || "받는 사람 없음" };
  },
};

/** 연결 전 수단 — 밖으로 아무것도 보내지 않고 「미발송」만 돌려준다. */
const notReady = (channel: Channel, label: string): Sender => ({
  channel, label, ready: false,
  async send() {
    return { channel, label, ok: false, count: 0, status: "미발송(연결 준비 중)" };
  },
});

export const SENDERS: Record<Channel, Sender> = {
  app: appSender,
  sms: notReady("sms", "문자"),
  email: emailSender,                 // 09-25 사용자: 메일 발송 포함 — 설정이 없으면 「발송 대기」로만 기록
  kakao: notReady("kakao", "카카오톡"), // 문자 · 카카오톡은 외부 시스템 연동이 필요해 지금처럼 연결 준비 중(09-25 사용자)
};

/** 화면의 수단 체크 칸 순서. note = 준비 안 된 까닭(화면이 보여 줄 수 있게 — 전자우편은 「메일 서버 설정 필요」). */
export const CHANNEL_LIST: { channel: Channel; label: string; ready: boolean; note: string }[] =
  (["app", "sms", "email", "kakao"] as Channel[]).map((c) => ({
    channel: c, label: SENDERS[c].label, ready: SENDERS[c].ready,
    note: SENDERS[c].ready ? "" : c === "email" ? "메일 서버 설정 필요" : "연결 준비 중",
  }));

export const isChannel = (v: string): v is Channel => v in SENDERS;

/** 고른 수단마다 보낸다. 하나가 실패해도 나머지는 계속한다. */
export async function sendAll(msg: OutMessage, channels: Channel[]): Promise<SendResult[]> {
  const out: SendResult[] = [];
  for (const c of channels) {
    const s = SENDERS[c];
    try {
      out.push(await s.send(msg));
    } catch (e: any) {
      out.push({ channel: c, label: s.label, ok: false, count: 0, status: `실패(${String(e?.message || e).slice(0, 60)})` });
    }
  }
  return out;
}

/** 발신 기록의 수단 칸(「app,sms」) → 화면 글자(「앱 알림 · 문자」). 수단 칸이 없던 옛 기록은 앱 알림. */
export function channelText(v: any): string {
  const list = String(v || "app").split(",").map((x) => x.trim()).filter(isChannel);
  return (list.length ? list : ["app" as Channel]).map((c) => SENDERS[c].label).join(" · ");
}

/** 발신 기록의 수단별 결과 칸(JSON 글자) → [[수단 이름, 결과]]. 읽지 못하면 빈 목록. */
export function resultList(v: any): [string, string][] {
  if (!v) return [];
  try {
    const o = typeof v === "string" ? JSON.parse(v) : v;
    return Object.entries(o || {}).map(([k, s]) => [isChannel(k) ? SENDERS[k].label : k, String(s)]);
  } catch {
    return [];
  }
}

/** 발신 번호마다 받는 사람별 앱 알림(읽음 여부 = read_at). */
export async function receiptsOf(msgIds: string[]): Promise<Map<string, Row[]>> {
  const want = new Map(msgIds.map((id) => [noteOf(id), id]));
  const out = new Map<string, Row[]>(msgIds.map((id) => [id, []]));
  for (const n of await readTable("notification", "notif_id")) {
    const id = want.get(String(n.note || ""));
    if (id) out.get(id)!.push(n);
  }
  return out;
}
