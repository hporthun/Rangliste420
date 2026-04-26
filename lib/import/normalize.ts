/**
 * Lowercase particles that stay uncapitalized when not the first word of a name.
 * Covers German (von, zu, van), Dutch (van, de, den, ter, ten),
 * French (de, du, des, d', le, la), Italian (di, da, del, della),
 * Spanish (de, del), and common combos.
 */
const NAME_PARTICLES = new Set([
  "von", "zu", "zum", "zur", "vom",
  "van", "de", "den", "der", "des", "het", "ter", "ten", "op",
  "du", "des", "le", "la", "les",
  "di", "da", "del", "della", "delle", "dei", "degli",
  "af", "av",
]);

/**
 * Title-cases a name: first letter of each word/hyphen-part uppercase, rest lowercase.
 * Lowercase particles (von, van, de, di, …) stay lowercase unless they start the name.
 * Examples:
 *   "MÜLLER-SCHMIDT"       → "Müller-Schmidt"
 *   "nikolaus von luckner" → "Nikolaus von Luckner"
 *   "wilderich van lengerich" → "Wilderich van Lengerich"
 */
export function toTitleCase(name: string): string {
  const lowered = name.trim().toLowerCase();
  // Split on spaces, keeping the separators for reconstruction
  const tokens = lowered.split(/(\s+)/);
  return tokens
    .map((token, i) => {
      // Keep whitespace tokens as-is
      if (/^\s+$/.test(token)) return token;
      // Within hyphenated parts, apply per-part logic
      return token
        .split(/(-)/)
        .map((part, j) => {
          if (part === "-") return "-";
          // First token of the whole name always capitalised
          const isFirstOverall = i === 0 && j === 0;
          // Particles stay lowercase unless they are the very first word
          if (!isFirstOverall && NAME_PARTICLES.has(part)) return part;
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join("");
    })
    .join("");
}

/**
 * Normalizes a name for fuzzy comparison.
 * Pipeline: trim → lowercase → NFD decompose → remove combining marks
 *   → umlaut mapping (ä→ae etc.) → hyphen/dot/underscore → space → collapse whitespace
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    // NFC first so umlauts are composed (ü = single codepoint, not u + combining)
    .normalize("NFC")
    // German umlauts before NFD decomposition strips them
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    // NFD to decompose remaining accented chars (André → Andre + combining acute)
    .normalize("NFD")
    // remove all combining diacritical marks
    .replace(/[\u0300-\u036f]/g, "")
    // hyphens, underscores, dots → space
    .replace(/[-_.]+/g, " ")
    // collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns both "firstname lastname" and "lastname firstname" orderings.
 * Handles "Lastname, Firstname" comma format.
 */
export function nameVariants(raw: string): string[] {
  const normalized = normalizeName(raw);
  // If comma present: "mueller, max" → ["mueller max", "max mueller"]
  if (raw.includes(",")) {
    const [last, first] = normalized.split(/,\s*/);
    const a = `${last} ${first}`.trim();
    const b = `${first} ${last}`.trim();
    return [...new Set([a, b, normalized])];
  }
  // Otherwise produce reversed variant too
  const parts = normalized.split(" ");
  if (parts.length >= 2) {
    const reversed = [...parts].reverse().join(" ");
    return [...new Set([normalized, reversed])];
  }
  return [normalized];
}
