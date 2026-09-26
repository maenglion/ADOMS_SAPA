# -*- coding: utf-8 -*-
r"""
정합성 검수 v1.7 — check_integrity_v15.py 의 V1~V12 를 그대로 쓰고(가져와 부른다) 관리주체 검사 2개를 더한다(2026-09-24).
  V13 다른 기관 시설에 「해당·확인필요」 배정 (0 이어야 정상)
  V14 관리주체 칸이 빈 FMS 시설 (0 이어야 정상)
전(ops_v1.5 까지 · us_v1.1) ↔ 후(최신 ops · us) 를 같은 규칙으로 잰다. 결과 → 가장 새 ops 판 폴더\_integrity_report.json
"""
import io, json, os, collections as C
import check_integrity_v15 as B
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)

def extra(T):
    R = {}
    tier = {a["asset_id"]: a.get("subject_tier", "") for a in T["asset"]}
    R["V13 다른 기관 시설에 「해당·확인필요」 배정"] = sum(1 for d in T["duty_assignment"] if tier.get(d["asset_id"]) == "타기관" and d["applicability"] != "비해당")
    R["V14 관리주체 칸이 빈 FMS 시설"] = sum(1 for a in T["asset"] if a.get("source") == "FMS" and not a.get("subject_tier"))
    R["참고 관리주체 분포"] = dict(C.Counter(tier.values()))
    R["참고 배정 해당 여부"] = dict(C.Counter(d["applicability"] for d in T["duty_assignment"]))
    return R

def main():
    b = B.load("ops_v1.5_20260924", us=True); a = B.load(None, us=True)
    before = {**B.check(b, "전"), **extra(b)}; after = {**B.check(a, "후"), **extra(a)}
    ov = B.overlay_check({r["dept_id"] for r in a["org_dept"]}, {r["staff_id"] for r in a["staff"]} | {"CEO-1"})
    rc = {t: (before["행 수"].get(t), after["행 수"].get(t)) for t in sorted(set(before["행 수"]) | set(after["행 수"])) if before["행 수"].get(t) != after["행 수"].get(t)}
    rep = {"전": {k: v for k, v in before.items() if k != "행 수"}, "후": {k: v for k, v in after.items() if k != "행 수"}, "행 수가 바뀐 표": rc, "화면 입력 저장 파일": ov}
    io.open(os.path.join(DEMO, sorted(x for x in os.listdir(DEMO) if x.startswith("ops_"))[-1], "_integrity_report.json"), "w", encoding="utf-8").write(json.dumps(rep, ensure_ascii=False, indent=1))
    for k in after:
        if k != "행 수": print("%s\n   전: %s\n   후: %s" % (k, before.get(k, "-"), after[k]))
    print("행 수가 바뀐 표:", rc); print("화면 입력 저장 파일:", ov)

if __name__ == "__main__":
    main()
