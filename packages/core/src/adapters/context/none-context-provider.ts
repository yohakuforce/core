// NoneContextProvider — デフォルト実装。外部コンテキストを一切取得しない。
//
// OSS 利用者の既定。Context-Hub を opt-in していない環境では常にこれが使われ、
// explain / change-summary は従来通り「決定的ファクトのみ」を材料に動く。

import type { ContextBrief, ContextProvider, ContextTarget } from "../../types/context-provider.js";

export class NoneContextProvider implements ContextProvider {
  readonly kind = "none" as const;

  async relatedContext(target: ContextTarget): Promise<ContextBrief> {
    return { target, snippets: [], empty: true };
  }

  async close(): Promise<void> {
    // 何も保持しないので no-op。
  }
}
