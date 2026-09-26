/** 「분류 — 세부」 메뉴 이름에서 「— 세부」를 조금 작게(09-25 사용자: 앞의 분류명과 구분). 대시(—)가 없으면 그대로. */
export default function SubLabel({ text }: { text: string }) {
  const i = text.indexOf(" — ");
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<small className="us-sublabel"> — {text.slice(i + 3)}</small></>;
}
