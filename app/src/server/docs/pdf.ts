import { degrees, PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import { SYNTHETIC_LABEL } from "@/lib/contracts/documents";

// Small deterministic PDF writer used for every generated download and fixture.
// Fixed metadata dates and producer keep bytes stable, so fixtures are hash-matchable.
// Standard fonts only (WinAnsi); text outside that set is transliterated.

const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z");
const PAGE = { w: 612, h: 792 };
const M = { x: 54, top: 60, bottom: 64 };
const INK = rgb(0.13, 0.13, 0.16);
const MUTED = rgb(0.42, 0.42, 0.47);
const LINE = rgb(0.86, 0.86, 0.88);
const FILL = rgb(0.957, 0.957, 0.961); // #F4F4F5 table header
const WARN = rgb(0.62, 0.12, 0.12);

const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const MAP: Record<string, string> = { "→": "->", "←": "<-", "−": "-", "≠": "!=", "≤": "<=", "≥": ">=", "✓": "yes", "✗": "no", " ": " ", " ": " ", " ": " " };

export function winAnsi(text: string): string {
  let out = "";
  for (const ch of text.replace(/\r/g, "")) {
    const code = ch.codePointAt(0)!;
    if (ch === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)) out += ch;
    else out += MAP[ch] ?? "?";
  }
  return out;
}

export interface PdfMeta {
  title: string;
  subject?: string;
  /** Footer line, e.g. the fixture id and what it tests. */
  footer?: string;
  watermark?: boolean;
}

export class Pdf {
  private page!: PDFPage;
  private y = 0;
  private constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
    private meta: PdfMeta,
  ) {}

  static async create(meta: PdfMeta): Promise<Pdf> {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.setTitle(winAnsi(meta.title), { showInWindowTitleBar: false });
    doc.setSubject(winAnsi(meta.subject ?? SYNTHETIC_LABEL));
    doc.setAuthor("Nexa QLE demo (synthetic)");
    doc.setCreator("Nexa QLE demo generator");
    doc.setProducer("Nexa QLE demo generator (pdf-lib)");
    doc.setKeywords(["synthetic", "demo", "not valid for enrollment"]);
    doc.setCreationDate(FIXED_DATE);
    doc.setModificationDate(FIXED_DATE);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const pdf = new Pdf(doc, font, bold, meta);
    pdf.newPage();
    return pdf;
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE.w, PAGE.h]);
    // Synthetic label band on every page.
    this.page.drawRectangle({ x: M.x, y: PAGE.h - 44, width: PAGE.w - 2 * M.x, height: 24, borderColor: WARN, borderWidth: 1.2, color: rgb(1, 0.96, 0.96) });
    const label = SYNTHETIC_LABEL;
    const lw = this.bold.widthOfTextAtSize(winAnsi(label), 11);
    this.page.drawText(winAnsi(label), { x: (PAGE.w - lw) / 2, y: PAGE.h - 36, size: 11, font: this.bold, color: WARN });
    if (this.meta.watermark) {
      this.page.drawText("SYNTHETIC DEMO", { x: 130, y: 220, size: 56, font: this.bold, color: rgb(0.93, 0.9, 0.9), rotate: degrees(35) });
    }
    this.y = PAGE.h - M.top - 12;
  }

  private ensure(h: number) {
    if (this.y - h < M.bottom) this.newPage();
  }

  private wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const para of winAnsi(text).split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = "";
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(next, size) <= width) line = next;
        else {
          if (line) lines.push(line);
          // Hard-break very long tokens.
          let rest = w;
          while (font.widthOfTextAtSize(rest, size) > width) {
            let i = rest.length;
            while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > width) i--;
            lines.push(rest.slice(0, i));
            rest = rest.slice(i);
          }
          line = rest;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  private text(text: string, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gap?: number; width?: number } = {}) {
    const size = o.size ?? 10;
    const font = o.bold ? this.bold : this.font;
    const x = M.x + (o.indent ?? 0);
    const width = o.width ?? PAGE.w - M.x - x;
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: o.color ?? INK });
      this.y -= size + 4;
    }
    this.y -= o.gap ?? 4;
  }

  title(text: string, sub?: string) {
    this.text(text, { size: 17, bold: true, gap: 2 });
    if (sub) this.text(sub, { size: 10, color: MUTED, gap: 8 });
    this.rule();
    return this;
  }
  heading(text: string) {
    this.ensure(40);
    this.y -= 6;
    this.text(text, { size: 12.5, bold: true, gap: 4 });
    return this;
  }
  para(text: string, o: { muted?: boolean; size?: number; bold?: boolean } = {}) {
    this.text(text, { size: o.size ?? 10, color: o.muted ? MUTED : INK, bold: o.bold });
    return this;
  }
  bullets(items: string[]) {
    for (const it of items) {
      this.ensure(14);
      this.page.drawText("-", { x: M.x + 4, y: this.y - 10, size: 10, font: this.font, color: INK });
      this.text(it, { indent: 16, gap: 1 });
    }
    this.y -= 4;
    return this;
  }
  rule() {
    this.ensure(8);
    this.page.drawLine({ start: { x: M.x, y: this.y }, end: { x: PAGE.w - M.x, y: this.y }, thickness: 0.6, color: LINE });
    this.y -= 10;
    return this;
  }
  /** Label/value grid. */
  kv(rows: [string, string][]) {
    const labelW = 170;
    for (const [k, v] of rows) {
      const vLines = this.wrap(v, this.font, 10, PAGE.w - 2 * M.x - labelW);
      const kLines = this.wrap(k, this.font, 9.5, labelW - 10);
      const h = Math.max(vLines.length, kLines.length) * 14 + 4;
      this.ensure(h);
      kLines.forEach((l, i) => this.page.drawText(l, { x: M.x, y: this.y - 10 - i * 14, size: 9.5, font: this.font, color: MUTED }));
      vLines.forEach((l, i) => this.page.drawText(l, { x: M.x + labelW, y: this.y - 10 - i * 14, size: 10, font: this.font, color: INK }));
      this.y -= h;
    }
    this.y -= 6;
    return this;
  }
  /** Table with a #F4F4F5 header row. Widths are fractions of the content width. */
  table(headers: string[], rows: string[][], widths?: number[]) {
    const total = PAGE.w - 2 * M.x;
    const ws = (widths ?? headers.map(() => 1 / headers.length)).map((f) => f * total);
    const drawRow = (cells: string[], header: boolean) => {
      const font = header ? this.bold : this.font;
      const size = header ? 8.5 : 9;
      const wrapped = cells.map((c, i) => this.wrap(c, font, size, ws[i] - 8));
      const h = Math.max(...wrapped.map((w) => w.length)) * 12 + 8;
      this.ensure(h);
      if (header) this.page.drawRectangle({ x: M.x, y: this.y - h, width: total, height: h, color: FILL });
      let x = M.x;
      wrapped.forEach((lines, i) => {
        lines.forEach((l, j) => this.page.drawText(l, { x: x + 4, y: this.y - 12 - j * 12, size, font, color: header ? MUTED : INK }));
        x += ws[i];
      });
      this.y -= h;
      this.page.drawLine({ start: { x: M.x, y: this.y }, end: { x: M.x + total, y: this.y }, thickness: 0.5, color: LINE });
    };
    drawRow(headers, true);
    for (const r of rows) drawRow(r, false);
    this.y -= 10;
    return this;
  }
  /** Boxed note, e.g. a boundary or disclaimer. */
  note(text: string) {
    const lines = this.wrap(text, this.font, 9, PAGE.w - 2 * M.x - 16);
    const h = lines.length * 12 + 12;
    this.ensure(h + 6);
    this.page.drawRectangle({ x: M.x, y: this.y - h, width: PAGE.w - 2 * M.x, height: h, borderColor: LINE, borderWidth: 0.8, color: rgb(0.985, 0.985, 0.99) });
    lines.forEach((l, i) => this.page.drawText(l, { x: M.x + 8, y: this.y - 14 - i * 12, size: 9, font: this.font, color: MUTED }));
    this.y -= h + 10;
    return this;
  }
  space(h = 8) {
    this.y -= h;
    return this;
  }

  async bytes(): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      const footer = winAnsi(`${this.meta.footer ?? this.meta.title} · Page ${i + 1} of ${pages.length}`);
      p.drawLine({ start: { x: M.x, y: 48 }, end: { x: PAGE.w - M.x, y: 48 }, thickness: 0.5, color: LINE });
      for (const [j, line] of this.wrap(footer, this.font, 8, PAGE.w - 2 * M.x).slice(0, 2).entries()) {
        p.drawText(line, { x: M.x, y: 36 - j * 10, size: 8, font: this.font, color: MUTED });
      }
    });
    return this.doc.save({ useObjectStreams: false });
  }
}
