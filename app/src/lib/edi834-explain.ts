// Plain-language reading of the illustrative 834 lines this demo generates. Pure and
// client-safe: it only interprets text; it never changes the file.

const REL: Record<string, string> = { "18": "employee (self)", "01": "spouse", "19": "child" };
const MAINT: Record<string, string> = { "021": "add", "024": "end coverage", "001": "change" };
const REASON: Record<string, string> = { "01": "divorce", "02": "birth", "05": "adoption", "32": "marriage", EC: "benefit selection", AI: "no reason given" };
const LINE: Record<string, string> = { HLT: "medical", DEN: "dental", VIS: "vision" };
const LEVEL: Record<string, string> = { EMP: "employee only", ESP: "employee + spouse", ECH: "employee + children", FAM: "family" };
const QTY: Record<string, string> = { TO: "Total member records", ET: "Employee records", DT: "Dependent records" };
const DTP: Record<string, string> = { "007": "File effective date", "303": "Change effective date", "348": "Coverage starts", "349": "Coverage ends" };

const date = (d: string | undefined) => (d && /^\d{8}$/.test(d) ? `${d.slice(4, 6)}/${d.slice(6, 8)}/${d.slice(0, 4)}` : (d ?? ""));

export type EdiLine = { segment: string; meaning: string; member: boolean };

export function explain834(text: string): EdiLine[] {
  const segs = text
    .split("~")
    .map((s) => s.trim())
    .filter((s) => /^[A-Z][A-Z0-9]{1,2}\*/.test(s));
  let inMember = false;
  return segs.map((segment) => {
    const f = segment.split("*");
    const id = f[0];
    if (id === "INS") inMember = true;
    if (id === "SE") inMember = false;
    let meaning = "";
    switch (id) {
      case "ISA":
        meaning = `Interchange envelope: from ${f[6]?.trim()} to ${f[8]?.trim()}, control ${f[13]}, ${f[15] === "T" ? "test" : "production"} file`;
        break;
      case "GS":
        meaning = `Functional group: benefit enrollment (BE), version ${f[8]}`;
        break;
      case "ST":
        meaning = "Transaction set 834: benefit enrollment and maintenance";
        break;
      case "BGN":
        meaning = `File header: reference ${f[2]}, created ${date(f[3])} at ${f[4]?.slice(0, 2)}:${f[4]?.slice(2)} ET, ${f[8] === "2" ? "change (update) file" : "file"}`;
        break;
      case "REF":
        meaning = f[1] === "38" ? `Master policy (group) ${f[2]}` : f[1] === "0F" ? `Subscriber ID ${f[2]}` : f[1] === "1L" ? `Group number ${f[2]}` : f[1] === "ZZ" ? `Operation key ${f[2]} (prevents duplicate processing)` : `Reference ${f[2]}`;
        break;
      case "DTP":
        meaning = `${DTP[f[1]] ?? "Date"}: ${date(f[3])}`;
        break;
      case "QTY":
        meaning = `${QTY[f[1]] ?? "Count"}: ${f[2]}`;
        break;
      case "N1":
        meaning = f[1] === "P5" ? `Plan sponsor: ${f[2]}` : f[1] === "IN" ? `Insurer: ${f[2]}` : `Party: ${f[2]}`;
        break;
      case "INS":
        meaning = `Member record: ${REL[f[2]] ?? "member"}, ${MAINT[f[3]] ?? f[3]}, reason ${REASON[f[4]] ?? f[4]}${f[8] === "FT" ? ", full-time employee" : ""}`;
        break;
      case "NM1":
        meaning = `Member name: ${f[4] ?? ""} ${f[3] ?? ""}`.trim();
        break;
      case "DMG":
        meaning = `Date of birth: ${date(f[2])}`;
        break;
      case "HD":
        meaning = `Coverage: ${LINE[f[3]] ?? f[3]}, plan ${f[4]}, ${LEVEL[f[5]] ?? f[5]} (${MAINT[f[1]] ?? f[1]})`;
        break;
      case "SE":
        meaning = `End of transaction: ${f[1]} segments`;
        break;
      case "GE":
        meaning = "End of functional group";
        break;
      case "IEA":
        meaning = "End of interchange";
        break;
      default:
        meaning = id;
    }
    return { segment: `${segment}~`, meaning, member: inMember && id !== "INS" ? true : id === "INS" };
  });
}
