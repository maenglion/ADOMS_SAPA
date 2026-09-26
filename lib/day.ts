/**
 * 날짜 문자열(YYYY-MM-DD)은 **한국 시각(지역 시각)** 으로 만든다(2026-09-22).
 * `toISOString().slice(0, 10)` 은 UTC 라서 자정~오전 9시에는 「오늘」이 어제로 잡혔다(오전 시연에서 드러나는 결함).
 * 서버는 한국 시각으로 도는 PC 에서 돈다 — 다른 곳에 올릴 때는 TZ=Asia/Seoul 로 띄운다.
 */
export function ymd(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
