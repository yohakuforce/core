// ----------------------------------------------------------------------------
// テストカバレッジの正規化型
//
// 入力ソース (sf CLI / Tooling API / フォーマット差) を吸収し、yohaku 内部では
// この単一表現で扱う。`.yohaku/coverage.json` にもこの形で保存。
// ----------------------------------------------------------------------------

export type CoverageApexType = "ApexClass" | "ApexTrigger";

export interface CoverageEntry {
  readonly apexName: string;
  readonly type: CoverageApexType;
  readonly numLinesCovered: number;
  readonly numLinesUncovered: number;
  /** 0..100 (小数 1 桁丸め) */
  readonly coveredPercent: number;
}

export interface CoverageReport {
  readonly version: 1;
  /** ISO 文字列 */
  readonly generatedAt: string;
  /** 取り込み元の origin label (ファイルパスや "tooling-api" 等) */
  readonly source: string;
  /** Org 全体カバレッジ (% , 取得できれば) */
  readonly orgWideCoverage?: number;
  /** このテスト run 内のカバレッジ (%) */
  readonly testRunCoverage?: number;
  readonly entries: readonly CoverageEntry[];
}

export const DEFAULT_COVERAGE_PATH = ".yohaku/coverage.json";

export class CoverageParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoverageParseError";
  }
}
