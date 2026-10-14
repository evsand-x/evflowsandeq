/** CSV import preserves decimal text. It never evaluates spreadsheet formulae. */
export function parseBankStatementCsv(source: string) {
  if (source.length > 2_000_000) throw new Error("CSV melebihi batas 2 MB.");
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  for (let index = 0; index <= text.length; index++) {
    const ch = text[index];
    if (quoted) {
      if (ch === undefined) throw new Error("Tanda kutip CSV belum ditutup.");
      if (ch === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      if (field || closed) throw new Error("Format tanda kutip CSV tidak valid.");
      quoted = true;
    } else if (ch === "," || ch === "\n" || ch === "\r" || ch === undefined) {
      row.push(field);
      field = "";
      closed = false;
      if (ch !== ",") {
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
        if (ch === "\r" && text[index + 1] === "\n") index++;
        if (rows.length > 1001) throw new Error("Maksimum 1.000 mutasi per impor.");
      }
    } else {
      if (closed) throw new Error("Karakter setelah tanda kutip CSV tidak valid.");
      field += ch;
    }
  }
  const columns = ["external_id", "reference", "value_date", "amount", "description"] as const;
  const header = rows.shift();
  if (!header || header.join(",") !== columns.join(","))
    throw new Error(`Header CSV wajib: ${columns.join(",")}`);
  if (!rows.length) throw new Error("CSV belum berisi mutasi.");
  return rows.map((cells, index) => {
    if (cells.length !== columns.length)
      throw new Error(`Jumlah kolom baris ${index + 2} tidak sesuai.`);
    const [external_id, reference, value_date, amount, description] = cells as [
      string,
      string,
      string,
      string,
      string,
    ];
    if (
      !external_id.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value_date) ||
      !/^-?\d+(\.\d{1,8})?$/.test(amount)
    )
      throw new Error(
        `ID, tanggal atau nominal baris ${index + 2} tidak valid. Nominal memakai titik desimal tanpa pemisah ribuan.`,
      );
    return { external_id, reference, value_date, amount, description };
  });
}
