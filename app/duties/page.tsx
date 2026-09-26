// [캡처 v2] 설명 문단·카드 설명·근거 조문 줄을 뺐다(근거는 카드 title 로). 축 선택은 칩 한 줄.
import { UsLayout } from "@/components/us/Parts";
import MenuSide from "@/components/us/MenuSide";
import Link from "next/link";
import FlowBar from "@/components/FlowBar";
import { duties, distinctDuties, foldByUnit } from "@/lib/data";
import { DUTY36, AREA36 } from "@/lib/duty36";

/** [캡처 v2] 관계 법령 조문이 아니라 중대재해처벌법 자체의 체계 의무 — 전용 업무 화면에서 관리한다(09-24 점검 K04). */
const OWN_SCREEN: Record<string, { href: string; label: string; why: string }> = {
  I02: { href: "/system", label: "체계 제2호", why: "시행령 제4조제2호 — 전담 조직은 체계 판정 화면에서" },
  I04: { href: "/budget", label: "예산", why: "시행령 제4조제4호 — 안전·보건 예산 화면에서" },
  I07: { href: "/system/record?clause=7", label: "체계 제7호", why: "시행령 제4조제7호 — 종사자 의견 청취 기록" },
  I11: { href: "/recurrence#ord-list", label: "개선·시정명령", why: "법 제4조제1항제3호 — 개선·시정명령 대장" },
  I14: { href: "/contracts", label: "도급", why: "법 제5조 — 도급·용역·위탁 현황" },
};

export const dynamic = "force-dynamic";


export default async function Duties({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const axis = sp.axis || "";
  // 같은 재해 구분 안에서 똑같은 의무가 두 줄로 들어온 것(예시 자료 60줄)은 한 줄로 — 세 보기의 합을 같게 한다(09-24)
  const rows = foldByUnit(await duties({ limit: 100000 }));

  if (!axis) {
    const targets = new Set(rows.map((r) => r.target_code)).size;
    const laws = new Set(rows.map((r) => r.law)).size;
    return (
      <UsLayout side={<MenuSide group="법 의무사항" />}>   {/* 09-25: 좌측 = 머리 메뉴 법 의무사항과 같은 구성 */}
        <FlowBar step="duties" role={role} />
        <h1 className="v2h">의무 이행사항</h1>
        <div className="grid g3" style={{ marginTop: 14 }}>
          <Link className="axis-card" href={`/duties?role=${role}&axis=code`}>
            <div className="t">① 중처법 의무조항별</div>
            <div className="n">의무 {distinctDuties(rows).toLocaleString()}건</div>
          </Link>
          <Link className="axis-card" href={`/duties?role=${role}&axis=target`}>
            <div className="t">② 관리대상별</div>
            <div className="n">{targets}종</div>
          </Link>
          <Link className="axis-card" href={`/duties?role=${role}&axis=law`}>
            <div className="t">③ 관계법령별</div>
            <div className="n">{laws}개 법률</div>
          </Link>
        </div>
      </UsLayout>
    );
  }

  // 축별 1단 목록
  const group = (key: string, name: (r: any) => string) => {
    const m = new Map<string, { name: string; n: number; y: number }>();
    rows.forEach((r) => {
      const k = r[key] || "-";
      const o = m.get(k) || { name: name(r), n: 0, y: 0 };
      o.n++; if (r.yongin_mark === "Y") o.y++;
      m.set(k, o);
    });
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  };

  return (
    <UsLayout side={<MenuSide group="법 의무사항" />}>   {/* 09-25: 좌측 = 머리 메뉴 법 의무사항과 같은 구성 */}
      <h1 className="v2h">의무 이행사항</h1>
      <div className="chips">
        <Link className={`chip ${axis === "code" ? "on" : ""}`} href={`/duties?role=${role}&axis=code`}>① 중처법 의무조항별</Link>
        <Link className={`chip ${axis === "target" ? "on" : ""}`} href={`/duties?role=${role}&axis=target`}>② 관리대상별</Link>
        <Link className={`chip ${axis === "law" ? "on" : ""}`} href={`/duties?role=${role}&axis=law`}>③ 관계법령별</Link>
        <span style={{ flex: 1 }} />
        <Link className="chip" href={`/duties/tree?role=${role}`}>법령 계층표</Link>
      </div>
      {/* [캡처 v2] 숫자 체계(09-24) — 재해 구분이 다르면 다른 의무(사용자 원칙). 세 보기의 합이 같다. */}
      <div className="chips">
        <span className="badge">의무 {distinctDuties(rows).toLocaleString()}</span>
      </div>

      {axis === "code" && (() => {
        // 의무조항 36 — 재해 구분 3열. 근거 조문은 카드 title 로만(화면 글자 줄이기).
        const cnt = new Map<string, { n: number; y: number }>();
        // [캡처 v2] 코드가 둘인 줄은 첫 코드로만 센다 — 36 카드 합 = 의무 수(09-24 숫자 체계 통일)
        rows.forEach((r) => [String(r.code36 || "").split(";")[0].trim()].filter(Boolean).forEach((c) => {
          const o = cnt.get(c) || { n: 0, y: 0 }; o.n++; if (r.yongin_mark === "Y") o.y++; cnt.set(c, o);
        }));
        return (
          <div className="d36">
            {(["I", "F", "M"] as const).map((a) => {
              const list = DUTY36.filter((d) => d.area === a);
              const tot = list.reduce((s2, d) => s2 + (cnt.get(d.code)?.n || 0), 0);
              return (
                <section key={a} className="d36-col">
                  <h2>{AREA36[a]}<span className="muted"> · {tot.toLocaleString()}</span></h2>
                  {list.map((d) => {
                    const v = cnt.get(d.code) || { n: 0, y: 0 };
                    // [캡처 v2] 관계 법령 의무가 붙지 않는 체계 의무(중대재해처벌법 자체) — 「0」 대신 그 업무 화면으로(09-24 점검 K04)
                    const own = OWN_SCREEN[d.code];
                    if (!v.n && own) {
                      return (
                        <Link key={d.code} className="card d36-card own" title={`${d.basis} — ${own.why}`} href={`${own.href}${own.href.includes("?") ? "&" : "?"}role=${role}`}>
                          <div className="d36-top"><span className="d36-code">{d.code}</span><b>{d.name}</b><span className="d36-n own">{own.label} →</span></div>
                        </Link>
                      );
                    }
                    return (
                      <Link key={d.code} className="card d36-card" title={d.basis}
                            href={`/duties/list?role=${role}&axis=code&code=${d.code}`}>
                        <div className="d36-top"><span className="d36-code">{d.code}</span><b>{d.name}</b><span className="d36-n">{v.n.toLocaleString()}</span></div>
                      </Link>
                    );
                  })}
                </section>
              );
            })}
          </div>
        );
      })()}

      {axis === "target" && (
        <div className="grid g4" style={{ marginTop: 12 }}>
          {group("target_code", (r) => r.target_name).map(([k, v]) => (
            <Link key={k} className="card" title={k} href={`/duties/list?role=${role}&axis=target&target=${k}`} style={{ textDecoration: "none" }}>
              <div style={{ fontWeight: 600, color: "var(--deep)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--blue)" }}>{v.n.toLocaleString()}</div>
            </Link>
          ))}
        </div>
      )}

      {axis === "law" && (
        <div style={{ marginTop: 12 }}>
          {[...new Map(rows.map((r) => [r.law_group, r.law_group_name])).entries()]
            .sort()
            .map(([g, gname]) => {
              const laws = group("law", (r) => r.law).filter(([k]) => rows.find((r) => r.law === k)?.law_group === g);
              return (
                <div key={g} style={{ marginTop: 14 }}>
                  <h2>{gname}</h2>
                  <div className="grid g4">
                    {laws.map(([k, v]) => (
                      <Link key={k} className="card" title={k} href={`/duties/list?role=${role}&axis=law&law=${encodeURIComponent(k)}`} style={{ textDecoration: "none" }}>
                        <div style={{ fontWeight: 600, color: "var(--deep)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--blue)" }}>{v.n.toLocaleString()}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </UsLayout>
  );
}
