import type { Section } from "../types";

// Sections have an optional `color`; most never set one. These are the hues the
// board's status accents are drawn from, cycled by position so two neighbouring
// sections never land on the same swatch.
const FALLBACK_COLORS = [
  "#7c8cff",
  "#4ee1a0",
  "#ff9f6b",
  "#f472b6",
  "#38bdf8",
  "#facc15",
  "#a78bfa",
];

/** The color to represent a section with. `index` is its position in the list. */
export function sectionColor(section: Section, index: number): string {
  return section.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/** section id -> color, for views that look colors up per task rather than per row. */
export function sectionColorMap(sections: Section[]): Map<number, string> {
  return new Map(sections.map((s, i) => [s.id, sectionColor(s, i)]));
}
