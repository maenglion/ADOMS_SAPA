/**
 * 시연 직전 운영 결정: 로컬 실행 자산에 의존하는 법령 확인 작업은
 * 별도 실행 서비스가 마련될 때까지 Production에서 시작하지 않는다.
 */
export const LAW_AGENT_EXECUTION_HELD = true;

export const LAW_AGENT_HOLD_MESSAGE =
  "시연 일정에 따라 자동 확인 실행은 현재 보류되어 있습니다. 기존 검증 결과와 확인 이력만 조회할 수 있습니다.";
