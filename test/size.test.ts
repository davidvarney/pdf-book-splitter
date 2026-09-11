import { describe, expect, it } from "vitest";
import { formatSize, parseSize } from "../src/size.js";

describe("parseSize", () => {
  it("parses plain byte counts", () => {
    expect(parseSize("1024")).toBe(1024);
  });

  it("parses KB, MB, GB (case-insensitive, binary units)", () => {
    expect(parseSize("1KB")).toBe(1024);
    expect(parseSize("2mb")).toBe(2 * 1024 ** 2);
    expect(parseSize("1GB")).toBe(1024 ** 3);
  });

  it("parses decimal values", () => {
    expect(parseSize("1.5MB")).toBe(Math.floor(1.5 * 1024 ** 2));
  });

  it("allows whitespace between number and unit", () => {
    expect(parseSize("50 MB")).toBe(50 * 1024 ** 2);
  });

  it("rejects invalid input", () => {
    expect(() => parseSize("abc")).toThrow();
    expect(() => parseSize("-5MB")).toThrow();
    expect(() => parseSize("0MB")).toThrow();
    expect(() => parseSize("5TB")).toThrow();
  });
});

describe("formatSize", () => {
  it("formats bytes at the largest sensible unit", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2.0 KB");
    expect(formatSize(5 * 1024 ** 2)).toBe("5.0 MB");
  });
});
