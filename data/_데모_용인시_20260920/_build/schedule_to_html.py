# -*- coding: utf-8 -*-
"""
정본 별표·별지서식 텍스트 → HTML 변환기 (2026-09-21)

왜 되는가
  법제처 원문의 별표·서식은 **괘선 문자**로 표를 그려 놓았다(┌ ─ ┬ ┐ │ ├ ┼ ┤ └ ┴ ┘).
  즉 이미 「표」라는 구조가 글자 안에 들어 있다. 세로줄(│) 위치를 열 경계로 읽으면
  그대로 <table> 로 옮길 수 있다. 사람이 다시 그릴 필요가 없다.

한계(숨기지 않는다)
  · 칸 합치기(colspan/rowspan)는 괘선만으로 완전히 복원되지 않는다 — 가로 경계(├┼┤)로
    행을 끊고, 같은 줄 안에서 세로줄이 빠진 자리는 앞 칸에 붙인다.
  · 서식의 「색상이 어두운 난」(관공서 기재란)은 글자로 표시돼 있지 않아 회색으로 칠하지 못한다.
  · 도장 자리·그림·로고는 원문에 없다.
  변환이 애매하면 **원문 그대로**를 <pre> 로 남긴다. 지어내지 않는다.
"""
import re

BOX_TOP = "┌┬┐"
BOX_MID = "├┼┤"
BOX_BOT = "└┴┘"
BOX_ALL = BOX_TOP + BOX_MID + BOX_BOT + "─│"
RULE_RE = re.compile(r"^[\s─│┌┬┐├┼┤└┴┘]+$")


def _is_rule(line: str) -> bool:
    """괘선만 있는 줄(칸 경계)인가."""
    return bool(line.strip()) and bool(RULE_RE.match(line))


def _cells(line: str):
    """세로줄로 끊어 칸 내용을 뽑는다."""
    if "│" not in line:
        return None
    parts = line.split("│")
    if parts and not parts[0].strip():
        parts = parts[1:]
    if parts and not parts[-1].strip():
        parts = parts[:-1]
    return [p.strip() for p in parts]


def _esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def to_html(text: str, title: str = "") -> str:
    """별표·서식 한 건을 HTML 조각으로. 표가 없으면 문단으로 낸다."""
    if not text:
        return ""
    lines = text.split("\n")
    out, buf_rows, in_table, head_done = [], [], False, False
    plain = []

    def flush_plain():
        if plain:
            t = "\n".join(plain).strip("\n")
            if t.strip():
                out.append('<p class="sch-p">%s</p>' % _esc(t).replace("\n", "<br>"))
            plain.clear()

    def flush_table():
        nonlocal in_table, head_done
        if not buf_rows:
            return
        n = max(len(r) for r in buf_rows)
        html = ['<table class="sch">']
        for i, r in enumerate(buf_rows):
            tag = "th" if i == 0 and len(buf_rows) > 1 else "td"
            cells = r + [""] * (n - len(r))
            html.append("<tr>" + "".join(
                "<%s>%s</%s>" % (tag, _esc(c).replace("\n", "<br>") or "&nbsp;", tag) for c in cells) + "</tr>")
        html.append("</table>")
        out.append("".join(html))
        buf_rows.clear()
        in_table, head_done = False, False

    row_break = True          # 가로 괘선(├┼┤)을 지났는가 — 지났으면 다음 줄은 새 행
    for raw in lines:
        line = raw.rstrip()
        if _is_rule(line):
            # 표의 시작·행 경계·끝
            if any(ch in line for ch in BOX_BOT) and buf_rows:
                flush_table()
            in_table = True
            row_break = True
            continue
        # 09-23: 표 안의 빈 줄은 표를 끊지 않는다(원문이 줄마다 빈 줄을 끼운 서식 — 승강기법 시행령 별표 6 등).
        if not line.strip() and (in_table or buf_rows):
            continue
        c = _cells(line)
        if c is not None:
            flush_plain()
            # 같은 칸이 여러 줄에 걸치면 이어 붙인다(가로 괘선을 지나지 않았고, 첫 칸이 비었을 때)
            # 행 나누기 규칙은 09-21 판 그대로(가로 괘선을 행 경계로 쓰지 않음 — 칸 일부만 가르는 괘선이 많다).
            if buf_rows and len(buf_rows[-1]) == len(c) and buf_rows[-1][0] \
               and _continued(buf_rows[-1], c):
                buf_rows[-1] = [_join(a, b) for a, b in zip(buf_rows[-1], c)]
            else:
                buf_rows.append(c)
            row_break = False
        else:
            if buf_rows:
                flush_table()
            if line.strip():
                plain.append(line.strip())
            elif plain:
                flush_plain()

    flush_table()
    flush_plain()
    body = "\n".join(out)
    if not body.strip():
        return '<pre class="sch-raw">%s</pre>' % _esc(text)
    head = '<h2 class="sch-title">%s</h2>' % _esc(title) if title else ""
    return head + body


ITEM_RE = re.compile(r"^(\d+\.|\d+\)|[가-하]\.|\(\d+\)|[①-⑳]|※|-|·|ㆍ|□|○)")


def _join(a: str, b: str) -> str:
    """칸 이어 붙이기(09-23). 번호 항목은 줄을 바꾸고, 줄 끝에서 잘린 말은 이어 쓴다.
    원문 괘선 표는 칸 폭에서 글을 끊는다 — 「수술이 불가피」+「한 상해」처럼 말 중간에서도 끊긴다.
    잘린 뒷부분의 첫 토막이 한 글자(한·해·고·는·이 …)면 붙여 쓰고, 아니면 띄어 쓴다(「약 9퍼센트」+「이상인」).
    앞 줄이 짧으면(12자 미만) 일부러 나눈 줄(서식 기재란 등)로 보고 줄을 바꾼다."""
    if not b:
        return a
    if not a:
        return b
    last = a.split("\n")[-1]
    if ITEM_RE.match(b) or len(last) < 12:
        return a + "\n" + b
    first = b.split(" ")[0]
    if len(first) == 1 and "가" <= first <= "힣":
        return a + b
    return a + " " + b


def _continued(prev, cur):
    """앞 줄의 칸이 이어지는 줄인가 — 첫 칸이 비어 있으면 이어짐으로 본다."""
    return len(prev) == len(cur) and not cur[0]


CSS = """
.sch{border-collapse:collapse;width:100%;margin:10px 0;font-size:.95rem}
.sch th,.sch td{border:1px solid #9aa7b4;padding:7px 9px;vertical-align:top;text-align:left;word-break:keep-all}
.sch th{background:#eef3f8;font-weight:700;color:#003675}
.sch-title{font-size:1.15rem;color:#172b4d;margin:14px 0 8px}
.sch-p{margin:6px 0;white-space:pre-wrap}
.sch-raw{white-space:pre;overflow:auto;background:#f7f7fa;border:1px solid #dce3ea;
         border-radius:8px;padding:12px;font-size:.85rem;line-height:1.5}
"""


def quality(text: str) -> str:
    """이 건이 표로 잘 바뀌는지 — good(표 생성) · raw(원문 그대로) · empty."""
    if not (text or "").strip():
        return "empty"
    h = to_html(text)
    return "good" if "<table" in h else "raw"


if __name__ == "__main__":
    import csv, io, os, sys, collections
    csv.field_size_limit(10 ** 8)
    src = sys.argv[1] if len(sys.argv) > 1 else \
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
            os.path.abspath(__file__)))), "build", "schedule_20260901_v2.1.csv")
    cnt = collections.Counter()
    rows = list(csv.DictReader(io.open(src, encoding="utf-8-sig")))
    for r in rows:
        cnt[r["schedule_kind"] + ":" + quality(r["schedule_text"])] += 1
    print("전체 %d건" % len(rows))
    for k, v in sorted(cnt.items()):
        print("  %-12s %6d  (%.1f%%)" % (k, v, v * 100 / len(rows)))
