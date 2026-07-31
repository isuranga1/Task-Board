const URL_REGEX = /https?:\/\/[^\s<>")]+/g;

/**
 * Finds every URL inside a block of text. Used to auto-detect links pasted
 * directly into the description (Notion-style: you just paste a URL into
 * the text, no separate "add link" step needed) and offer an expandable
 * preview for each one, in addition to the explicit Links list.
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  // De-duplicate — pasting the same link twice in a description shouldn't
  // produce two identical preview cards.
  return Array.from(new Set(matches));
}
