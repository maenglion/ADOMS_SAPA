"use client";
/**
 * 「전체 선택」 단추 — 같은 상자(.usa-pbox) 안의 체크 칸을 브라우저에서 바로 모두 켜거나 끈다.
 * 09-26 사용자: 이행현황 › 도급·용역·위탁 「전체 선택」이 작동 안 한다.
 *   전: 주소(all=d0/d1)를 바꿔 서버가 다시 그리게 했는데, 체크 칸이 defaultChecked(처음 값)라 이미 그려진 칸은 바뀌지 않았다.
 *   지금: 하나라도 꺼져 있으면 모두 켜고, 모두 켜져 있으면 모두 끈다(사용자가 손으로 끈 칸도 그대로 반영).
 */
export default function CheckAll({ name }: { name: string }) {
  return (
    <button
      type="button"
      className="usa-allt"
      title="전체 선택·해제"
      onClick={(e) => {
        const box = e.currentTarget.closest(".usa-pbox");
        if (!box) return;
        const cbs = [...box.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`)];
        const allOn = cbs.length > 0 && cbs.every((c) => c.checked);
        cbs.forEach((c) => { c.checked = !allOn; });
      }}
    >
      ⌄
    </button>
  );
}
