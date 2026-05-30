// ----------------------------------------------------------------------------
// ViewModel 共通ヘルパ
//
// 全タイプで使う「決定的だが定型な」セクション (business-meaning / change-history /
// impact-hint / related-domains) を一箇所にまとめる。
// ----------------------------------------------------------------------------

import type { EntityKind, KnowledgeGraph } from "../../types/graph.js";
import { getGitLogForPath } from "../../util/git-log.js";
import { escapeHtml } from "../escape.js";
import type { SectionViewModel } from "../types.js";

export function emptyLlmPlaceholderSection(
  id: SectionViewModel["id"],
  title: string,
  prompt: string,
  editableBlockId: string,
  preserved?: string,
): SectionViewModel {
  if (preserved !== undefined && preserved.trim() !== "") {
    // 過去の build で html-write 等で fill 済のコンテンツを優先採用
    return {
      id,
      title,
      editableBlockId,
      htmlContent: `\n        ${preserved}\n        `,
    };
  }
  return {
    id,
    title,
    editableBlockId,
    htmlContent: `
    <div class="llm-placeholder">
      <p class="muted">（このセクションは LLM で生成されます）</p>
      <p class="hint">${escapeHtml(prompt)}</p>
    </div>`,
  };
}

/**
 * 変更履歴セクション。sourcePath が指定されていれば `git log -- <path>` を引く。
 * git が無い / repo 外 / 履歴無しの場合はプレースホルダにフォールバック。
 */
export function changeHistorySection(
  sourcePath?: string,
  gitCwd?: string,
): SectionViewModel {
  if (sourcePath === undefined || sourcePath === "") {
    return {
      id: "change-history",
      title: "変更履歴",
      htmlContent: `<p class="muted">sourcePath が無いため履歴を取得できません。</p>`,
    };
  }
  const cwd = gitCwd ?? process.cwd();
  const commits = getGitLogForPath(sourcePath, { cwd, maxCount: 5 });
  if (commits === null) {
    return {
      id: "change-history",
      title: "変更履歴",
      htmlContent: `<p class="muted">git 履歴を取得できませんでした (git 未導入 / リポジトリ外 / 未追跡)。</p>`,
    };
  }
  if (commits.length === 0) {
    return {
      id: "change-history",
      title: "変更履歴",
      htmlContent: `<p class="muted">この対象に紐づく git コミットはありません。</p>`,
    };
  }
  return {
    id: "change-history",
    title: "変更履歴",
    htmlContent: `
    <p class="muted">直近 ${commits.length} 件 (<code>${escapeHtml(sourcePath)}</code>)</p>
    <table class="data-table">
      <thead><tr><th>SHA</th><th>日時</th><th>Author</th><th>Subject</th></tr></thead>
      <tbody>
        ${commits
          .map(
            (c) => `<tr>
          <td><code>${escapeHtml(c.sha)}</code></td>
          <td>${escapeHtml(c.date.slice(0, 10))}</td>
          <td>${escapeHtml(c.author)}</td>
          <td>${escapeHtml(c.subject)}</td>
        </tr>`,
          )
          .join("\n        ")}
      </tbody>
    </table>`,
  };
}

export function impactHintSection(entityRef: string): SectionViewModel {
  return {
    id: "impact-hint",
    title: "影響範囲ヒント",
    htmlContent: `
    <p>このコンポーネントの影響範囲を確認するには:</p>
    <pre><code>yohaku impact ${escapeHtml(entityRef)}</code></pre>`,
  };
}

export function relatedDomainsSection(
  kind: EntityKind,
  fullyQualifiedName: string,
  graph: KnowledgeGraph,
): SectionViewModel {
  const domains = graph.tags
    .filter(
      (t) =>
        t.namespace === "domain" &&
        t.entity.kind === kind &&
        t.entity.fullyQualifiedName === fullyQualifiedName,
    )
    .map((t) => t.value);
  const htmlContent =
    domains.length === 0
      ? `<p class="muted">未分類 (Phase 5 の <code>yohaku domains init</code> 実行後に自動付与されます)。</p>`
      : `<ul>${domains.map((d) => `<li><code>${escapeHtml(d)}</code></li>`).join("")}</ul>`;
  return { id: "related-domains", title: "関連ドメイン", htmlContent };
}

export function listOrPlaceholderHtml(
  items: readonly string[],
  emptyText: string,
): string {
  if (items.length === 0) {
    return emptyText === "" ? "" : `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }
  return `<ul>${items.map((it) => `<li><code>${escapeHtml(it)}</code></li>`).join("")}</ul>`;
}

export function unique<T>(arr: readonly T[]): T[] {
  return Array.from(new Set(arr));
}
