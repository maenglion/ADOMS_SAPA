/**
 * 이행률 소수점 — 한 자리까지 **버림**(09-26 사용자: 「소숫점 처리는 보수적으로 판단하자는 차원에서 버림으로 하자」).
 * 모든 화면(대시보드 · 이행현황표 · 이행점검 · 의무이행)이 이 함수 하나를 쓴다.
 * 1e-9 를 더하는 까닭: 57.1 이 57.0999… 로 계산되면 57.0 으로 잘못 버려지는 것을 막는다.
 */
export const floor1 = (p: number) => Math.floor(p * 10 + 1e-9) / 10;
export const pctFloor = (p: number | null | undefined) => (p === null || p === undefined ? "-" : `${floor1(p).toFixed(1)}%`);
