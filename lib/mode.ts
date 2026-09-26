import "server-only";

/**
 * [매뉴얼 캡처용 사본] 보기 모드를 항상 현장 모드로 고정한다.
 * 원본(adoms2)은 쿠키 adoms-mode 로 내부 검토 ↔ 현장을 고른다.
 */
export async function isDemoMode(): Promise<boolean> {
  return true;
}
