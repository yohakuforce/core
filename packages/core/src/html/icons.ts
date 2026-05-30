// ----------------------------------------------------------------------------
// Inline SVG アイコンセット (ミニマル / ストローク / Salesforce 風)
//
// 絵文字を避け、SVG line-icon で統一する。サイズは em ベースで親フォントに追随。
// strokeWidth=1.6, viewBox=24, currentColor で塗る。
// ----------------------------------------------------------------------------

type IconName =
  | "search"
  | "chart-bar"
  | "diagram"
  | "tree"
  | "folder"
  | "object"
  | "apex"
  | "trigger"
  | "flow"
  | "lwc"
  | "chevron-right"
  | "chevron-down"
  | "external"
  | "tag";

const SVG_OPEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;
const SVG_CLOSE = `</svg>`;

const ICON_BODIES: Record<IconName, string> = {
  search: `<circle cx="10.5" cy="10.5" r="6"/><path d="m20 20-5.4-5.4"/>`,
  "chart-bar": `<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M22 20H2"/>`,
  diagram: `<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/><rect x="9" y="15" width="6" height="6" rx="1.5"/><path d="M6 9v3a2 2 0 0 0 2 2h4"/><path d="M18 9v3a2 2 0 0 1-2 2h-4"/>`,
  tree: `<path d="M5 4v16"/><path d="M5 8h6"/><path d="M5 14h6"/><path d="M5 20h6"/><circle cx="13" cy="8" r="1.5"/><circle cx="13" cy="14" r="1.5"/><circle cx="13" cy="20" r="1.5"/>`,
  folder: `<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5v10A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5z"/>`,
  // SObject: stacked layers (database-like)
  object: `<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>`,
  // Apex: code-like braces
  apex: `<path d="M8 4c-2 0-3 1-3 3v3c0 1.3-.7 2-2 2 1.3 0 2 .7 2 2v3c0 2 1 3 3 3"/><path d="M16 4c2 0 3 1 3 3v3c0 1.3.7 2 2 2-1.3 0-2 .7-2 2v3c0 2-1 3-3 3"/>`,
  // Trigger: lightning bolt
  trigger: `<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>`,
  // Flow: circular arrows
  flow: `<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7-3.3"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7 3.3"/><path d="m17 3 2 3-3 2"/><path d="M7 21l-2-3 3-2"/>`,
  // LWC: component grid
  lwc: `<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>`,
  "chevron-right": `<path d="m9 6 6 6-6 6"/>`,
  "chevron-down": `<path d="m6 9 6 6 6-6"/>`,
  external: `<path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>`,
  tag: `<path d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8z"/><circle cx="8.5" cy="8.5" r="1.2"/>`,
};

export function icon(name: IconName, options?: { size?: string; className?: string }): string {
  const size = options?.size ?? "1em";
  const cls = options?.className ?? "icon";
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="${size}" height="${size}" aria-hidden="true">${ICON_BODIES[name]}</svg>`;
}

export const ICONS_CSS = `
.icon { display: inline-block; vertical-align: -2px; flex-shrink: 0; }
.icon-button { display: inline-flex; align-items: center; gap: 6px; }
`;
