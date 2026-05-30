export { computeDiff } from "./diff.js";
export type { ComputeDiffOptions } from "./diff.js";
export { classifyChangedFile } from "./classify-files.js";
export { diffFiles, runGit, statusCharToChangeKind, GitInvocationError } from "./git.js";
export { DIFF_FILE_LIMIT_DEFAULT } from "./types.js";
export type { ChangeKind, ChangedFile, DiffCategory, RawDiff } from "./types.js";
export { renderDiffHtml, DIFF_CSS } from "./html-render.js";
export type { DiffHtmlOptions } from "./html-render.js";
