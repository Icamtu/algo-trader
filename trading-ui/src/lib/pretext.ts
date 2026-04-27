import { prepare, layout, type PreparedText } from "@chenglou/pretext";

/**
 * Pretext utility for high-performance text layout measurement in AetherDesk.
 * Primarily used for calculating accurate heights for virtualized lists (Logs, Tickers, JSON payloads).
 */

const FONT_LOGS = "9px 'JetBrains Mono', monospace";
const LINE_HEIGHT_LOGS = 14;

// Cache for prepared text handles to avoid redundant segment analysis
const pretextCache = new Map<string, PreparedText>();

export const PRETEXT_FONTS = {
  LOGS: FONT_LOGS,
  TERMINAL: "10px 'JetBrains Mono', monospace",
  OPTION_CHAIN: "11px 'JetBrains Mono', monospace",
  TABLE_CELL: "11px 'JetBrains Mono', monospace",
  TABLE_CELL_SMALL: "9px 'JetBrains Mono', monospace",
  UI: "14px 'Inter', sans-serif",
  UI_BOLD: "700 14px 'Inter', sans-serif",
};

export const PRETEXT_LINE_HEIGHTS = {
  LOGS: LINE_HEIGHT_LOGS,
  TERMINAL: 16,
  OPTION_CHAIN: 18,
  TABLE_CELL: 20,
  TABLE_CELL_SMALL: 16,
  UI: 20,
};

/**
 * Prepares text for layout. Memoizes the resulting PreparedText handle.
 */
export function getPreparedText(text: string, font: string = FONT_LOGS): PreparedText {
  const cacheKey = `${font}:${text}`;
  if (pretextCache.has(cacheKey)) {
    return pretextCache.get(cacheKey)!;
  }

  const prepared = prepare(text, font, { whiteSpace: "pre-wrap" });
  pretextCache.set(cacheKey, prepared);
  return prepared;
}

/**
 * Measures the height of a text block given a maximum width.
 */
export function measureHeight(
  text: string,
  width: number,
  font: string = FONT_LOGS,
  lineHeight: number = LINE_HEIGHT_LOGS
): number {
  if (!text) return 0;
  const prepared = getPreparedText(text, font);
  const { height } = layout(prepared, width, lineHeight);
  return height;
}

/**
 * Clears the internal Pretext cache.
 */
export function clearPretextCache(): void {
  pretextCache.clear();
}
