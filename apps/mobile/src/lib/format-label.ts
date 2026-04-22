/** Converts AI-generated snake_case labels to readable Title Case for display. */
export function formatLabel(label: string): string {
  return label
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
