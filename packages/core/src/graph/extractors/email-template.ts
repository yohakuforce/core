import type { EmailTemplate } from "../../types/graph.js";
import { asBoolean, asString, parseXml } from "../parse-xml.js";
import type { ExtractContext } from "./types.js";

export function extractEmailTemplate({
  descriptor,
  content,
}: ExtractContext): EmailTemplate | undefined {
  const root = parseXml(content);
  const node = (root.EmailTemplate ?? {}) as Record<string, unknown>;

  return {
    fullyQualifiedName: descriptor.fullyQualifiedName,
    name: asString(node.name),
    subject: asString(node.subject),
    type: asString(node.type),
    uiType: asString(node.uiType),
    encodingKey: asString(node.encodingKey),
    available: asBoolean(node.available),
    description: asString(node.description),
    sourcePath: descriptor.sourcePath,
    contentHash: descriptor.contentHash,
  };
}
