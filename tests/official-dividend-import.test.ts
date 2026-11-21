import assert from "node:assert/strict";
import test from "node:test";
import { parseOfficialDividendCsv } from "../lib/official-dividend-import.ts";

const asOf = new Date("2026-11-16T00:00:00.000Z");

test("imports the latest BSE dividend per scrip and leaves unreported metrics unavailable", () => {
  const csv = [
    "Security Code,Security Name,Company Name,Ex Date,Purpose,Record Date,Actual Payment Date",
    "539151,ARFIN,Arfin India Ltd,17 Nov 2025,Interim Dividend - Rs. - 0.1100,17 Nov 2025,-",
    "539151,ARFIN,Arfin India Ltd,21 May 2026,Final Dividend - Rs. - 0.2500,21 May 2026,2 Jun 2026",
    "000001,ONE,Other Co,20 May 2026,Bonus issue,21 May 2026,-",
    "000002,TWO,Older Co,15 Nov 2025,Dividend - Rs. - 1.00,15 Nov 2025,-",
  ].join("\n");

  const result = parseOfficialDividendCsv(csv, "BSE", asOf);

  assert.equal(result.companies.length, 1);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.skippedRows, 2);
  assert.equal(result.companies[0].symbol, "BSE:539151");
  assert.equal(result.companies[0].exchangeSymbol, "ARFIN");
  assert.equal(result.companies[0].dividend, 0.25);
  assert.equal(result.companies[0].exDate, "21 May 2026");
  assert.equal(result.companies[0].announcement, "");
  assert.equal(result.companies[0].yield, null);
  assert.equal(result.companies[0].marketCap, null);
  assert.equal(result.companies[0].payout, null);
});

test("imports NSE equity dividend rows and skips non-equity series", () => {
  const csv = [
    "SYMBOL,COMPANY NAME,SERIES,PURPOSE,FACE VALUE,EX-DATE,RECORD DATE,BOOK CLOSURE START DATE,BOOK CLOSURE END DATE",
    "PFC,Power Finance Corporation Limited,EQ,Interim Dividend - Re 4.10 Per Share,10,16-Nov-2026,16-Nov-2026,-,-",
    "PGINVIT,Infrastructure Investment Trust,IV,Distribution - Rs 3 Per Unit,100,16-Nov-2026,16-Nov-2026,-,-",
  ].join("\n");

  const result = parseOfficialDividendCsv(csv, "NSE", asOf);

  assert.equal(result.companies.length, 1);
  assert.equal(result.skippedRows, 1);
  assert.equal(result.companies[0].symbol, "NSE:PFC");
  assert.equal(result.companies[0].dividend, 4.1);
  assert.equal(result.companies[0].recordDate, "16 Nov 2026");
  assert.equal(result.companies[0].paymentDate, "");
});

test("rejects CSVs that do not match the selected exchange export", () => {
  assert.throws(
    () => parseOfficialDividendCsv("Name,Symbol\nExample,EX", "BSE", asOf),
    /does not match the official BSE/,
  );
});
