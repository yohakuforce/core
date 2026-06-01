import type { Field } from "../../types/graph.js";
import { asArray, asBoolean, asString, parseXml } from "../parse-xml.js";
import type { ExtractContext } from "./types.js";

export function extractField({ descriptor, content }: ExtractContext): Field | undefined {
  const root = parseXml(content);
  const node = (root.CustomField ?? {}) as Record<string, unknown>;
  const [object] = descriptor.fullyQualifiedName.split(".");
  if (object === undefined) return undefined;

  const referenceTo = asArray<string>(node.referenceTo as string | readonly string[] | undefined);
  const valueSet = node.valueSet as Record<string, unknown> | undefined;
  const picklistValues = extractPicklistValues(valueSet);

  return {
    fullyQualifiedName: descriptor.fullyQualifiedName,
    object,
    label: asString(node.label),
    description: asString(node.description),
    type: asString(node.type) ?? "Unknown",
    required: asBoolean(node.required),
    unique: asBoolean(node.unique),
    isCustom: descriptor.fullyQualifiedName.endsWith("__c"),
    referenceTo: referenceTo.length > 0 ? referenceTo : undefined,
    picklistValues: picklistValues.length > 0 ? picklistValues : undefined,
    formula: asString(node.formula),
    defaultValue: asString(node.defaultValue),
    sourcePath: descriptor.sourcePath,
    contentHash: descriptor.contentHash,
  };
}

function extractPicklistValues(valueSet: Record<string, unknown> | undefined): readonly string[] {
  if (valueSet === undefined) return [];
  const valueSetDefinition = valueSet.valueSetDefinition as Record<string, unknown> | undefined;
  if (valueSetDefinition === undefined) return [];
  const valueRaw = valueSetDefinition.value;
  const arr = asArray(valueRaw as Record<string, unknown> | readonly Record<string, unknown>[]);
  return arr.map((v) => asString(v.fullName)).filter((s): s is string => typeof s === "string");
}
