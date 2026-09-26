import { deflateRawSync } from "node:zlib";
/**
 * 아주 작은 엑셀(.xlsx) 작성기 — 새 npm 패키지 없이 Node 기본 기능(Buffer)만 쓴다.
 * 09-25 사용자: 「엑셀 내려받기가 CSV입니다. xlsx로 바꿀까요? → 엑셀로 바꾸자.」
 *
 * 만드는 것
 *   - 저장식(압축 없음) zip + CRC32 — 엑셀·한셀·LibreOffice·openpyxl 모두 연다
 *   - SpreadsheetML 최소 구성: [Content_Types].xml · _rels/.rels · xl/workbook.xml · xl/_rels/workbook.xml.rels
 *     · xl/styles.xml · xl/worksheets/sheetN.xml (글자는 inlineStr — sharedStrings 없이)
 *   - 여러 시트 · 머리 줄 굵게(회색 바탕·테두리) · 칸 너비(글자 수로 자동, 한글은 두 칸) · 머리 줄 아래 틀 고정
 *   - 숫자는 숫자 칸, 글자는 글자 칸. 글자로 온 숫자(CSV 에서 읽은 "12000")도 숫자로 넣는다(autoNum) —
 *     단 앞자리 0("007")·16자리 이상(식별번호)·날짜("2026-09-25")·백분율("85%")은 글자 그대로 둔다(화면과 같게).
 *
 * 쓰는 법(route)
 *   return xlsxResponse("이행현황_2026", [{ name: "이행현황", rows: [head, ...body] }]);
 *   rows 앞에 제목 줄이 있으면 headRow 로 머리 줄 위치(0부터)를 알려 준다 — 너비 계산은 머리 줄부터.
 */

export type XCell = string | number | boolean | null | undefined;
export type XSheet = {
  name: string;
  rows: XCell[][];
  /** 머리 줄의 위치(0부터). 기본 0. 머리 줄이 없으면 -1. 틀 고정은 이 줄 아래에서 한다. */
  headRow?: number;
  /** 굵게만 할 줄(제목 줄 등, 0부터). */
  boldRows?: number[];
  /** 칸 너비(글자 수). 없는 칸은 자동. */
  widths?: number[];
  /** 틀 고정 — 기본 true(머리 줄 아래). 첫 칸까지 고정하려면 freezeCol: 1. */
  freeze?: boolean;
  freezeCol?: number;
  /** 글자로 온 숫자를 숫자 칸으로 — 기본 true. */
  autoNum?: boolean;
  /** 천 단위 쉼표로 보일 칸(금액 등, 0부터). */
  commaCols?: number[];
};

/* ── CRC32(zip 이 요구하는 검사값) ─────────────────────────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ── 저장식 zip ────────────────────────────────────────────────── */
function dosTime(d: Date) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xffff, date: date & 0xffff };
}
function zipStored(files: { name: string; data: Buffer }[]): Buffer {
  const { time, date } = dosTime(new Date());
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const size = f.data.length;
    // 09-25: 압축(deflate) — 저장식이면 의무목록 파일이 10MB 가 넘었다. 엑셀·한셀·LibreOffice·openpyxl 모두 deflate 를 읽는다
    const body = deflateRawSync(f.data);
    const csize = body.length;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4); // 풀 때 필요한 판
    lh.writeUInt16LE(0x0800, 6); // 이름이 UTF-8
    lh.writeUInt16LE(8, 8); // deflate
    lh.writeUInt16LE(time, 10);
    lh.writeUInt16LE(date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(csize, 18);
    lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, body);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10); // deflate
    ch.writeUInt16LE(time, 12);
    ch.writeUInt16LE(date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(csize, 20);
    ch.writeUInt32LE(size, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30); // extra
    ch.writeUInt16LE(0, 32); // comment
    ch.writeUInt16LE(0, 34); // disk
    ch.writeUInt16LE(0, 36); // 내부 속성
    ch.writeUInt32LE(0, 38); // 외부 속성
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += lh.length + name.length + csize;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, end]);
}

/* ── SpreadsheetML ─────────────────────────────────────────────── */
// XML 에 넣을 수 없는 제어 문자(탭·줄바꿈 제외)와 BOM 은 뺀다.
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F﻿￾￿]/g;
const x = (s: string) =>
  s.replace(CTRL, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function colName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** 표시 너비 — 한글·한자·전각은 2, 나머지 1. 여러 줄이면 가장 긴 줄. */
function dispWidth(s: string): number {
  let best = 0;
  for (const line of s.split(/\r?\n/)) {
    let w = 0;
    for (const ch of line) w += /[ᄀ-ᇿ⺀-꓏가-힯豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1;
    best = Math.max(best, w);
  }
  return best;
}

const NUM_RE = /^-?(0|[1-9]\d{0,14})(\.\d+)?$/;
function asNumber(v: XCell, autoNum: boolean): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (autoNum && typeof v === "string" && NUM_RE.test(v.trim()) && v.trim().length <= 16) return Number(v.trim());
  return null;
}

// 스타일 번호(cellXfs 순서): 0 기본 · 1 머리(굵게·회색·테두리·가운데·줄바꿈) · 2 굵게(제목 줄) · 3 본문 글자(테두리)
//   · 4 본문 숫자(테두리 · 일반 — 연도·건수가 「2,026」처럼 되지 않게) · 5 본문 금액(테두리 · 천 단위 쉼표, commaCols)
const S = { head: 1, bold: 2, text: 3, num: 4, comma: 5 };
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFECEEED"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetXml(sh: XSheet): string {
  const headRow = sh.headRow ?? 0;
  const autoNum = sh.autoNum !== false;
  const bold = new Set(sh.boldRows || []);
  const comma = new Set(sh.commaCols || []);
  const nCols = sh.rows.reduce((m, r) => Math.max(m, r.length), 0);

  // 칸 너비 — 머리 줄부터 센다(위의 제목 줄은 길어도 칸을 넓히지 않는다).
  const widths: number[] = [];
  for (let c = 0; c < nCols; c++) {
    if (sh.widths?.[c]) { widths.push(sh.widths[c]); continue; }
    let w = 4;
    for (let r = Math.max(0, headRow); r < sh.rows.length; r++) {
      const v = sh.rows[r][c];
      if (v === null || v === undefined || v === "") continue;
      const n = asNumber(v, autoNum);
      w = Math.max(w, n !== null ? n.toLocaleString("en-US").length : dispWidth(String(v)));
    }
    widths.push(Math.min(60, Math.max(6, w + 2)));
  }

  const out: string[] = [];
  out.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`);
  out.push(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`);
  const lastRef = `${colName(Math.max(0, nCols - 1))}${Math.max(1, sh.rows.length)}`;
  out.push(`<dimension ref="A1:${lastRef}"/>`);

  const fr = sh.freeze === false || headRow < 0 ? 0 : headRow + 1;
  const fc = sh.freezeCol || 0;
  if (fr || fc) {
    const tl = `${colName(fc)}${fr + 1}`;
    const pane = fr && fc ? "bottomRight" : fr ? "bottomLeft" : "topRight";
    out.push(`<sheetViews><sheetView workbookViewId="0"><pane${fc ? ` xSplit="${fc}"` : ""}${fr ? ` ySplit="${fr}"` : ""} topLeftCell="${tl}" activePane="${pane}" state="frozen"/><selection pane="${pane}" activeCell="${tl}" sqref="${tl}"/></sheetView></sheetViews>`);
  } else {
    out.push(`<sheetViews><sheetView workbookViewId="0"/></sheetViews>`);
  }
  out.push(`<sheetFormatPr defaultRowHeight="16.5"/>`);
  if (nCols) out.push(`<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`);

  out.push(`<sheetData>`);
  sh.rows.forEach((row, ri) => {
    const cells: string[] = [];
    const isHead = ri === headRow;
    const isBody = headRow < 0 ? true : ri > headRow;
    row.forEach((v, ci) => {
      const ref = `${colName(ci)}${ri + 1}`;
      const style = isHead ? S.head : bold.has(ri) ? S.bold : null;
      if (v === null || v === undefined || v === "") {
        const s = style ?? (isBody ? S.text : 0);
        if (s) cells.push(`<c r="${ref}" s="${s}"/>`);
        return;
      }
      const n = isHead ? null : asNumber(v, autoNum);
      if (n !== null) {
        cells.push(`<c r="${ref}" s="${style ?? (isBody ? (comma.has(ci) ? S.comma : S.num) : 0)}"><v>${n}</v></c>`);
      } else if (typeof v === "boolean") {
        cells.push(`<c r="${ref}" t="b" s="${style ?? (isBody ? S.text : 0)}"><v>${v ? 1 : 0}</v></c>`);
      } else {
        const s = style ?? (isBody ? S.text : 0);
        cells.push(`<c r="${ref}" t="inlineStr"${s ? ` s="${s}"` : ""}><is><t xml:space="preserve">${x(String(v))}</t></is></c>`);
      }
    });
    out.push(`<row r="${ri + 1}">${cells.join("")}</row>`);
  });
  out.push(`</sheetData>`);
  out.push(`<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>`);
  out.push(`</worksheet>`);
  return out.join("");
}

/** 시트 이름 — 31자 이하, []:*?/\ 빼고, 겹치면 뒤에 (2). */
function sheetNames(sheets: XSheet[]): string[] {
  const used = new Set<string>();
  return sheets.map((s, i) => {
    let base = String(s.name || `Sheet${i + 1}`).replace(/[\[\]:*?/\\]/g, " ").replace(CTRL, "").trim().slice(0, 31) || `Sheet${i + 1}`;
    let name = base, k = 2;
    while (used.has(name.toLowerCase())) { const tail = `(${k++})`; name = base.slice(0, 31 - tail.length) + tail; }
    used.add(name.toLowerCase());
    return name;
  });
}

/** 시트 여러 개 → .xlsx 바이트. */
export function xlsxBuffer(sheets: XSheet[]): Buffer {
  if (!sheets.length) sheets = [{ name: "Sheet1", rows: [] }];
  const names = sheetNames(sheets);
  const enc = (s: string) => Buffer.from(s, "utf8");
  const files: { name: string; data: Buffer }[] = [];

  files.push({
    name: "[Content_Types].xml",
    data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`),
  });
  files.push({
    name: "_rels/.rels",
    data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
  });
  files.push({
    name: "xl/workbook.xml",
    data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView activeTab="0"/></bookViews>
<sheets>${names.map((n, i) => `<sheet name="${x(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`),
  });
  files.push({
    name: "xl/_rels/workbook.xml.rels",
    data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
  });
  files.push({ name: "xl/styles.xml", data: enc(STYLES) });
  sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc(sheetXml(s)) }));
  return zipStored(files);
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** 파일 이름(확장자 없이도 됨)과 시트들 → 내려받기 응답. 한글 이름은 filename*=UTF-8'' 로 보낸다. */
export function xlsxResponse(fileName: string, sheets: XSheet[]): Response {
  const name = /\.xlsx$/i.test(fileName) ? fileName : `${fileName.replace(/\.(csv|xls)$/i, "")}.xlsx`;
  const buf = xlsxBuffer(sheets);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="download.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Content-Length": String(buf.length),
    },
  });
}
