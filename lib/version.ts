/**
 * Application version string, sourced from package.json.
 * Bundled at build time — no runtime fs access.
 *
 * Version format: YYYY.MM.N  (CalVer — year.month.sequential)
 * package.json stores it without the leading zero (e.g. "2026.4.1") to keep
 * npm happy; this function pads the month segment for display ("2026.04.1").
 */
import packageJson from "../package.json";

function formatVersion(v: string): string {
  const parts = v.split(".");
  if (parts.length === 3) {
    const [year, month, seq] = parts;
    return `${year}.${month.padStart(2, "0")}.${seq}`;
  }
  return v;
}

export const APP_VERSION = formatVersion(packageJson.version);
