// File-type checks from bytes, never from the filename.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export type AllowedType = "application/pdf" | "image/png" | "image/jpeg";

export function sniffType(b: Uint8Array): AllowedType | null {
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf"; // %PDF-
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

const ALIASES: Record<string, AllowedType> = {
  "application/pdf": "application/pdf",
  "application/x-pdf": "application/pdf",
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
};

/** Declared type from the browser. Generic or empty types defer to the bytes. */
export function declaredMismatch(declared: string, sniffed: AllowedType): boolean {
  const d = declared.split(";")[0].trim().toLowerCase();
  if (!d || d === "application/octet-stream") return false;
  return ALIASES[d] !== sniffed;
}

/** Active PDF content (scripts, launch actions, embedded files, XFA) is refused. Defense in depth only. */
export function pdfHasActiveContent(b: Uint8Array): boolean {
  const text = Buffer.from(b).toString("latin1");
  return /\/(JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|XFA)\b/.test(text);
}

export function cleanUploadName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, "").trim().slice(0, 120);
  return cleaned || "document";
}
