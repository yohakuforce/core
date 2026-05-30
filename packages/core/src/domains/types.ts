// ----------------------------------------------------------------------------
// domains.yaml 型定義
//
// 「業務ドメイン」を index 階層として束ねるための YAML スキーマ。
// 初回は `yohaku domains init` がヒューリスティックで初期案を吐き、それを正本
// として人手で編集する。以後のビルドは決定的にこの YAML を読む。
// ----------------------------------------------------------------------------

import type { ComponentType } from "../html/sections.js";

export interface DomainMemberRef {
  /** 内部タイプ表記 (apex/trigger/lwc/object/flow) */
  readonly type: ComponentType;
  /** Fully qualified name */
  readonly name: string;
}

export interface DomainDef {
  /** ドメイン識別子 (英小文字 + ハイフン推奨) */
  readonly id: string;
  /** 人間向けラベル */
  readonly label: string;
  /** ドメイン説明 (任意) */
  readonly description?: string;
  /** primary domain メンバー (1 component は primary 1 + secondary N) */
  readonly members: readonly DomainMemberRef[];
}

export interface DomainsConfig {
  /** schema バージョン */
  readonly version: 1;
  /** ドメイン定義 */
  readonly domains: readonly DomainDef[];
  /**
   * 自由テキストの注釈。yohaku は読み取らないがエディタや PR レビュー用。
   */
  readonly notes?: string;
}

export const DEFAULT_DOMAINS_PATH = ".yohaku/domains.yaml";
