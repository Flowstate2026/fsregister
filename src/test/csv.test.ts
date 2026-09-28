import { describe, it, expect } from "vitest";
import { parseCsvDate } from "@/lib/csv-date";
import { parseCsvText, parseCsvLine, splitClassNames } from "@/lib/csv-parse";
import { parseStudentsCsv } from "@/lib/csv-import";

describe("parseCsvDate", () => {
  it("parses DD/MM/YYYY", () => {
    expect(parseCsvDate("12/03/2015")).toBe("2015-03-12");
  });

  it("parses DD-MM-YYYY", () => {
    expect(parseCsvDate("28-09-2012")).toBe("2012-09-28");
  });

  it("pads single-digit day and month", () => {
    expect(parseCsvDate("1/2/2015")).toBe("2015-02-01");
  });

  it("passes through ISO dates", () => {
    expect(parseCsvDate("2025-01-10")).toBe("2025-01-10");
  });

  it("expands two-digit years", () => {
    expect(parseCsvDate("12/03/15")).toBe("2015-03-12");
  });

  it("returns undefined for empty or invalid input", () => {
    expect(parseCsvDate(undefined)).toBeUndefined();
    expect(parseCsvDate("")).toBeUndefined();
    expect(parseCsvDate("   ")).toBeUndefined();
    expect(parseCsvDate("not a date")).toBeUndefined();
  });
});

describe("parseCsvText", () => {
  it("parses simple rows", () => {
    expect(parseCsvText("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("respects quoted fields containing commas", () => {
    expect(parseCsvText('name,classes\nLily,"Jazz, Acro 3"')).toEqual([
      ["name", "classes"],
      ["Lily", "Jazz, Acro 3"],
    ]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    expect(parseCsvText('a\n"say ""hi""')).toEqual([["a"], ['say "hi"']]);
  });

  it("handles CRLF line endings and BOM", () => {
    expect(parseCsvText("\uFEFFa,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips empty lines", () => {
    expect(parseCsvText("a,b\n\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCsvLine", () => {
  it("parses a single line", () => {
    expect(parseCsvLine('Emma,Smith,"Jazz, Acro"')).toEqual(["Emma", "Smith", "Jazz, Acro"]);
  });
});

describe("splitClassNames", () => {
  it("splits comma-separated names", () => {
    expect(splitClassNames("Jazz, Acro 3, Performance Team")).toEqual([
      "Jazz",
      "Acro 3",
      "Performance Team",
    ]);
  });

  it("unwraps quoted values", () => {
    expect(splitClassNames('"Jazz, Acro 3"')).toEqual(["Jazz", "Acro 3"]);
  });

  it("returns empty array for empty input", () => {
    expect(splitClassNames(undefined)).toEqual([]);
    expect(splitClassNames("")).toEqual([]);
    expect(splitClassNames("  ")).toEqual([]);
  });

  it("trims whitespace around names", () => {
    expect(splitClassNames("  Ballet  ,  Tap ")).toEqual(["Ballet", "Tap"]);
  });
});

describe("parseStudentsCsv", () => {
  it("maps headers to student rows and parses dates", () => {
    const text =
      "first_name,last_name,date_of_birth,join_date,class_name,parent_email\n" +
      "Emma,Smith,12/03/2015,10/01/2025,Junior Ballet,parent@example.com";
    expect(parseStudentsCsv(text)).toEqual([
      {
        first_name: "Emma",
        last_name: "Smith",
        date_of_birth: "2015-03-12",
        join_date: "2025-01-10",
        class_name: "Junior Ballet",
        parent_email: "parent@example.com",
      },
    ]);
  });

  it("drops rows without a first name", () => {
    const text = "first_name,last_name\n,Jones\nEmma,Smith";
    const rows = parseStudentsCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].first_name).toBe("Emma");
  });

  it("returns empty array when there are no data rows", () => {
    expect(parseStudentsCsv("first_name,last_name")).toEqual([]);
  });
});
