// ----------------------------------------------------------------------------
// 軽量 git 連携
//
// `git log -- <path>` で直近 N コミットを取得する。git が無い / git repo でない /
// ファイルが追跡されていない場合は null を返す (絶対 throw しない)。
// HTML 設計書の「変更履歴」セクションで使用。
// ----------------------------------------------------------------------------

import { spawnSync } from "node:child_process";

export interface GitCommitInfo {
  readonly sha: string;
  readonly date: string; // ISO
  readonly author: string;
  readonly subject: string;
}

export interface GitLogOptions {
  readonly maxCount?: number;
  readonly cwd?: string;
  /** spawnSync を差し替える (テスト用) */
  readonly spawnSyncFn?: typeof spawnSync;
}

const DEFAULT_MAX = 5;
const SEP = ""; // unit separator — file path や subject に出にくい

/**
 * `<cwd>` リポジトリで `<path>` のコミット履歴を取得する。
 * 失敗時は null を返す (呼び側でプレースホルダ表示する)。
 */
export function getGitLogForPath(
  path: string,
  options?: GitLogOptions,
): readonly GitCommitInfo[] | null {
  const max = options?.maxCount ?? DEFAULT_MAX;
  const cwd = options?.cwd ?? process.cwd();
  const spawner = options?.spawnSyncFn ?? spawnSync;

  const format = `%H${SEP}%aI${SEP}%an${SEP}%s`;
  const result = spawner(
    "git",
    ["log", `--max-count=${max}`, `--pretty=format:${format}`, "--", path],
    { cwd, encoding: "utf8" },
  );

  if (result.error !== undefined || result.status === null || result.status !== 0) {
    return null;
  }
  const stdout = (result.stdout ?? "").trim();
  if (stdout === "") return [];

  const commits: GitCommitInfo[] = [];
  for (const line of stdout.split("\n")) {
    const parts = line.split(SEP);
    if (parts.length < 4) continue;
    commits.push({
      sha: (parts[0] ?? "").slice(0, 7),
      date: parts[1] ?? "",
      author: parts[2] ?? "",
      subject: parts[3] ?? "",
    });
  }
  return commits;
}
