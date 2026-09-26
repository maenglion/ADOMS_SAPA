/**
 * [400 · 교육자료 버전] 묶음 B2 공용 화면 조각 — 관리자(SCR-021~025)·법 의무사항(SCR-034·035)이 함께 쓴다.
 * 모양은 app/us.css(us-) + app/us-b2.css(usb2-).
 */
import Link from "next/link";

/** 주소 쿼리 만들기 — 빈 값은 뺀다. */
export function qs(base: string, p: Record<string, string | number | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

/** 페이지 번호(명세: 진회색 박스가 현재 쪽). */
export function Pager({ total, size, page, href }: { total: number; size: number; page: number; href: (p: number) => string }) {
  const n = Math.max(1, Math.ceil(total / size));
  if (n <= 1) return <div className="usb2-pager"><span className="on">1</span></div>;
  const from = Math.max(1, Math.min(page - 4, n - 9)), to = Math.min(n, from + 9);
  const list: number[] = [];
  for (let i = from; i <= to; i++) list.push(i);
  return (
    <div className="usb2-pager">
      {page > 1 && <Link href={href(page - 1)}>‹</Link>}
      {list.map((i) => (i === page ? <span key={i} className="on">{i}</span> : <Link key={i} href={href(i)}>{i}</Link>))}
      {page < n && <Link href={href(page + 1)}>›</Link>}
    </div>
  );
}

/** 「총 N명」 — 숫자만 파란색(명세 원문) */
export const Count = ({ n, unit }: { n: number; unit: string }) => (
  <div className="usb2-count">총 <b>{n.toLocaleString()}</b>{unit}</div>
);

/** 회색 둥근 검색 상자(명세 InlineSearchBar) */
export const SearchBox = ({ children }: { children: React.ReactNode }) => <div className="usb2-sbox">{children}</div>;

/** 모달(주소 쿼리로 여닫는다) */
export function Modal({ title, close, children, wide }: { title: string; close: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="us-modal-bg">
      <div className={`us-modal${wide ? " usb2-mwide" : ""}`}>
        <div className="us-modal-h"><span>{title}</span><Link href={close} className="usb2-x">✕</Link></div>
        <div className="us-modal-b">{children}</div>
      </div>
    </div>
  );
}

/** 알림 한 줄(저장했습니다 등) */
export const Note = ({ children }: { children: React.ReactNode }) => <div className="usb2-note">{children}</div>;
