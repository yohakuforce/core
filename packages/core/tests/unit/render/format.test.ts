import { describe, expect, it } from "vitest";
import {
  InvalidRenderFormatError,
  isRenderFormat,
  parseRenderFormats,
  resolveFormatOutputDir,
} from "../../../src/render/format.js";

describe("parseRenderFormats", () => {
  it("undefined はデフォルトの ['md']", () => {
    expect(parseRenderFormats(undefined)).toEqual(["md"]);
  });

  it("空文字も ['md']", () => {
    expect(parseRenderFormats("")).toEqual(["md"]);
    expect(parseRenderFormats("   ")).toEqual(["md"]);
  });

  it("'md' / 'html' 単独", () => {
    expect(parseRenderFormats("md")).toEqual(["md"]);
    expect(parseRenderFormats("html")).toEqual(["html"]);
  });

  it("'md,html' と 'html,md' は同じ正規順序", () => {
    expect(parseRenderFormats("md,html")).toEqual(["md", "html"]);
    expect(parseRenderFormats("html,md")).toEqual(["md", "html"]);
  });

  it("空白と大文字許容、重複除去", () => {
    expect(parseRenderFormats("  MD , Html  , md ")).toEqual(["md", "html"]);
  });

  it("不正値で InvalidRenderFormatError", () => {
    expect(() => parseRenderFormats("pdf")).toThrow(InvalidRenderFormatError);
    expect(() => parseRenderFormats("md,docx")).toThrow(InvalidRenderFormatError);
  });
});

describe("isRenderFormat", () => {
  it("true ケース", () => {
    expect(isRenderFormat("md")).toBe(true);
    expect(isRenderFormat("html")).toBe(true);
  });
  it("false ケース", () => {
    expect(isRenderFormat("pdf")).toBe(false);
    expect(isRenderFormat("MD")).toBe(false); // case sensitive (parse 側で小文字化)
  });
});

describe("resolveFormatOutputDir", () => {
  it("md は outRoot そのまま (後方互換)", () => {
    expect(resolveFormatOutputDir("/tmp/out", "md")).toBe("/tmp/out");
    expect(resolveFormatOutputDir("/tmp/out/", "md")).toBe("/tmp/out/");
  });
  it("html は outRoot/html", () => {
    expect(resolveFormatOutputDir("/tmp/out", "html")).toBe("/tmp/out/html");
    expect(resolveFormatOutputDir("/tmp/out/", "html")).toBe("/tmp/out/html");
  });
});
