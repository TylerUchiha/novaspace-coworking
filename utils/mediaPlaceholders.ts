/** Neutral SVG data-URI when a catalog/user image is missing (no third-party demo photos). */
export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">` +
      `<rect fill="#e2e8f0" width="800" height="600"/>` +
      `<text x="400" y="310" text-anchor="middle" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="28">No image</text>` +
      `</svg>`,
  );

export function imageOrPlaceholder(src?: string | null): string {
  const trimmed = src?.trim();
  return trimmed || PLACEHOLDER_IMAGE;
}
