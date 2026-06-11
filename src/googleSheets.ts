import { google, sheets_v4 } from "googleapis";
import { roleDedupeKey } from "./dedupe.js";
import {
  MACHINE_OWNED_ROLE_COLUMNS,
  PROTECTED_USER_SHEETS,
  SHEET_SCHEMAS,
  WORKBOOK_MANAGED_SHEETS,
  type SheetName,
} from "./schemas.js";
import type { ScoredJob } from "./types.js";

type CellValue = string | number | boolean | null | undefined;
type RowObject = Record<string, string>;

const ROLE_MANUAL_COLUMNS = ["Manual Score Override", "Status", "Notes", "Access Score"] as const;
const PROTECTED_USER_SHEET_SET = new Set<SheetName>(PROTECTED_USER_SHEETS);

function columnLetter(index: number): string {
  let dividend = index + 1;
  let letter = "";
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return letter;
}

function escapeFormulaString(value: string): string {
  return value.replace(/"/g, '""');
}

function stripBoldMarkers(value: string): string {
  return value.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
}

function hyperlinkFormula(url: string, title: string): string {
  return `=HYPERLINK("${escapeFormulaString(url)}","${escapeFormulaString(stripBoldMarkers(title))}")`;
}

function parseHyperlinkFormula(value: string): { url: string; title: string } | undefined {
  const match = value.match(/^=HYPERLINK\("([^"]+)","((?:""|[^"])*)"\)$/i);
  if (!match) return undefined;
  return { url: match[1], title: match[2].replace(/""/g, "\"") };
}

function cellToString(value: CellValue): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function rowToObject(headers: string[], row: CellValue[]): RowObject {
  return Object.fromEntries(headers.map((header, index) => [header, cellToString(row[index])]));
}

function parseManualScore(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function formatShortDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function finalBucketFormula(rowNumber: number): string {
  const score = `IF(LEN(I${rowNumber}),I${rowNumber},H${rowNumber})`;
  return `=IF(${score}>=90,"Pursue",IF(${score}>=75,"Potential",IF(${score}>=60,"Monitor","Deprioritize")))`;
}

function parseAccessScore(value: string, fallback: number): number {
  if (!value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(5, Math.round(parsed)));
}

function roleTitleFromRow(row: RowObject): { title: string; url?: string } {
  const titleLink = parseHyperlinkFormula(row["Role Title"] ?? "");
  return {
    title: titleLink?.title ?? row["Role Title"] ?? "",
    url: titleLink?.url ?? row.URL,
  };
}

function mappedRoleRow(row: RowObject, rowNumber: number): string[] {
  const titleInfo = roleTitleFromRow(row);
  const agentScore = row["Agent Score"] || row["Total Score"] || "";
  const title = titleInfo.url && titleInfo.title ? hyperlinkFormula(titleInfo.url, titleInfo.title) : titleInfo.title;
  const values: RowObject = {
    "Date Found": row["Date Found"] || "",
    Company: row.Company || "",
    "Role Title": title,
    Level: row.Level || "",
    Status: row.Status || "",
    Notes: row.Notes || "",
    "Final Bucket": finalBucketFormula(rowNumber),
    "Agent Score": agentScore,
    "Manual Score Override": row["Manual Score Override"] || "",
    "Fit Score": row["Fit Score"] || "",
    "Financial Upside Score": row["Financial Upside Score"] || "",
    "Compensation Score": row["Compensation Score"] || "",
    "Scope Score": row["Scope Score"] || "",
    "Prestige Score": row["Prestige Score"] || "",
    "Access Score": row["Access Score"] || "",
    "Score Rationale": row["Score Rationale"] || "",
    "Last Updated": row["Last Updated"] || "",
    Source: row.Source || "",
  };

  return SHEET_SCHEMAS.Roles.map((header) => stripBoldMarkers(values[header] ?? ""));
}

function jobToRoleRow(job: ScoredJob, rowNumber: number, existing?: RowObject): string[] {
  const manualOverride = existing?.["Manual Score Override"] ?? job.manualScoreOverride;
  const accessScore = parseAccessScore(existing?.["Access Score"] ?? "", job.accessScore);
  parseManualScore(manualOverride);
  const now = new Date();
  const values: RowObject = {
    "Date Found": existing?.["Date Found"] || formatShortDate(job.dateFound),
    Company: job.company,
    "Role Title": hyperlinkFormula(job.url, job.title),
    Level: job.level,
    Status: existing?.Status || "Sourced",
    Notes: existing?.Notes || "",
    "Final Bucket": finalBucketFormula(rowNumber),
    "Agent Score": String(job.totalScore),
    "Manual Score Override": manualOverride,
    "Fit Score": String(job.fitScore),
    "Financial Upside Score": String(job.financialUpsideScore),
    "Compensation Score": String(job.compensationScore),
    "Scope Score": String(job.scopeScore),
    "Prestige Score": String(job.prestigeScore),
    "Access Score": String(accessScore),
    "Score Rationale": job.scoreRationale,
    "Last Updated": formatShortDate(now),
    Source: job.source,
  };

  return SHEET_SCHEMAS.Roles.map((header) => stripBoldMarkers(values[header] ?? ""));
}

export class GoogleSheetsClient {
  private sheets: sheets_v4.Sheets;

  private async refreshFinalBucketFormulas(rowCount: number): Promise<void> {
    if (rowCount <= 1) return;
    const formulas = Array.from({ length: rowCount - 1 }, (_, index) => [finalBucketFormula(index + 2)]);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `'Roles'!G2:G${rowCount}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: formulas },
    });
  }

  constructor(private spreadsheetId: string) {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.sheets = google.sheets({ version: "v4", auth });
  }

  async ensureWorkbookSchema(): Promise<void> {
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets.properties",
    });
    const sheetProperties = spreadsheet.data.sheets?.map((sheet) => sheet.properties).filter(Boolean) ?? [];
    const existingSheets = new Set(sheetProperties.map((properties) => properties?.title).filter(Boolean));
    const addSheetRequests = WORKBOOK_MANAGED_SHEETS
      .filter((sheetName) => !existingSheets.has(sheetName))
      .map((sheetName) => ({ addSheet: { properties: { title: sheetName } } }));

    if (addSheetRequests.length > 0) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests: addSheetRequests },
      });
    }

    for (const sheetName of WORKBOOK_MANAGED_SHEETS) {
      const headers = SHEET_SCHEMAS[sheetName];
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A:Z`,
        valueRenderOption: sheetName === "Roles" ? "FORMULA" : "FORMATTED_VALUE",
      });
      const [currentHeaders = [], ...rows] = response.data.values ?? [];
      const missingHeader = headers.length !== currentHeaders.length || headers.some((header, index) => currentHeaders[index] !== header);

      if (!missingHeader) {
        if (sheetName === "Roles") await this.refreshFinalBucketFormulas(rows.length + 1);
        continue;
      }

      const clearEndColumn = columnLetter(Math.max(headers.length, currentHeaders.length, 1) - 1);
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A1:${clearEndColumn}${Math.max(rows.length + 1, 1)}`,
      });

      const endColumn = columnLetter(headers.length - 1);
      const remappedRows = sheetName === "Roles" ? rows.map((row, index) => mappedRoleRow(rowToObject(currentHeaders, row), index + 2)) : [];
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A1:${endColumn}${Math.max(remappedRows.length + 1, 1)}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[...headers], ...remappedRows] },
      });
      if (sheetName === "Roles") await this.refreshFinalBucketFormulas(remappedRows.length + 1);
    }
  }

  async readRoles(): Promise<RowObject[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: "'Roles'!A:Z",
      valueRenderOption: "FORMULA",
    });
    const [headers = [], ...rows] = response.data.values ?? [];
    return rows.map((row) => rowToObject(headers, row));
  }

  async readSheetRows(sheetName: SheetName, valueRenderOption: "FORMATTED_VALUE" | "FORMULA" = "FORMATTED_VALUE"): Promise<RowObject[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `'${sheetName}'!A:Z`,
      valueRenderOption,
    });
    const [headers = [], ...rows] = response.data.values ?? [];
    return rows.map((row) => rowToObject(headers, row));
  }

  async appendSheetRows(sheetName: SheetName, rows: string[][]): Promise<void> {
    if (rows.length === 0) return;
    if (PROTECTED_USER_SHEET_SET.has(sheetName)) {
      throw new Error(`${sheetName} is user-managed and protected from automated writes.`);
    }
    const headers = SHEET_SCHEMAS[sheetName];
    const endColumn = columnLetter(headers.length - 1);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `'${sheetName}'!A1:${endColumn}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[...headers]] },
    });
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `'${sheetName}'!A:${endColumn}`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });
  }

  async upsertRoles(jobs: ScoredJob[]): Promise<{ added: number; updated: number }> {
    const existingRows = await this.readRoles();
    const headers = [...SHEET_SCHEMAS.Roles];
    const keyToRow = new Map<string, { rowNumber: number; row: RowObject }>();

    existingRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const titleInfo = roleTitleFromRow(row);
      if (row.Company && titleInfo.title && titleInfo.url) {
        keyToRow.set(roleDedupeKey({ company: row.Company, title: titleInfo.title, url: titleInfo.url }), { rowNumber, row });
      }
    });

    let added = 0;
    let updated = 0;
    const rowsToAppend: string[][] = [];
    const sortedJobs = [...jobs].sort((a, b) => b.finalScore - a.finalScore);

    for (const job of sortedJobs) {
      const existing = keyToRow.get(roleDedupeKey({ company: job.company, title: job.title, url: job.url }));

      if (!existing) {
        const appendRowNumber = existingRows.length + rowsToAppend.length + 2;
        rowsToAppend.push(jobToRoleRow(job, appendRowNumber));
        added += 1;
        continue;
      }

      const nextRow = [...headers.map((header) => existing.row[header] ?? "")];
      const scoredRow = jobToRoleRow(job, existing.rowNumber, existing.row);
      for (const columnName of MACHINE_OWNED_ROLE_COLUMNS) {
        const columnIndex = headers.indexOf(columnName);
        nextRow[columnIndex] = scoredRow[columnIndex];
      }

      for (const columnName of ROLE_MANUAL_COLUMNS) {
        const columnIndex = headers.indexOf(columnName);
        nextRow[columnIndex] = existing.row[columnName] ?? nextRow[columnIndex];
      }

      const endColumn = columnLetter(headers.length - 1);
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `'Roles'!A${existing.rowNumber}:${endColumn}${existing.rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [nextRow] },
      });
      updated += 1;
    }

    if (rowsToAppend.length > 0) {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: "'Roles'!A:R",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rowsToAppend },
      });
    }

    return { added, updated };
  }
}
