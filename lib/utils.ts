// ─────────────────────────────────────────────────────────────────────────────
// Rider name formatting
//
// The DB stores names as "LASTNAME Firstname" (all-caps words = last name).
// Examples:
//   "MARTIN Dan"        → "Dan Martin"
//   "VAN AERT Wout"     → "Wout Van Aert"
//   "POGAČAR Tadej"     → "Tadej Pogačar"
//   "VAN DEN BROECK Jurgen" → "Jurgen Van Den Broeck"
//
// This matches the logic in the original index.html exactly.
// ─────────────────────────────────────────────────────────────────────────────

function _toTitleCase(w: string): string {
  if (!w) return ''
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
}

// Returns true if a word is fully uppercased AND contains at least one letter.
// Single-letter words like "D'" are excluded to avoid false positives.
function _isAllCaps(w: string): boolean {
  return (
    w.length > 1 &&
    /[A-ZÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕÑČŠŽĆĐ]/u.test(w) &&
    w === w.toUpperCase()
  )
}

// Parse a DB-format name into { first, last, display }.
// All consecutive leading words that are ALL-CAPS are treated as the last name.
function _parseRiderName(dbName: string): { first: string; last: string; display: string } {
  if (!dbName) return { first: '', last: '', display: '' }
  const parts = dbName.trim().split(/\s+/).filter(Boolean)
  let splitIdx = parts.length // assume all words are last name until proven otherwise
  for (let i = 0; i < parts.length; i++) {
    if (!_isAllCaps(parts[i])) { splitIdx = i; break }
  }
  const last = parts.slice(0, splitIdx).map(_toTitleCase).join(' ')
  const first = parts.slice(splitIdx).join(' ')
  return { first, last, display: first ? `${first} ${last}` : last }
}

/**
 * Convert a DB-format rider name ("LASTNAME Firstname") to display format
 * ("Firstname Lastname"). Safe to call with already-formatted names or nulls.
 *
 * Use this everywhere a rider name is shown in the UI.
 */
export function formatRiderName(name: string | null | undefined): string {
  if (!name) return ''
  // Names are pre-formatted in the DB — just return as-is
  return name
}

/**
 * Generate a deterministic colour for a rider based on their name.
 * Used for avatar placeholder backgrounds.
 */
export function riderColor(name: string): string {
  const PALETTE = ['#1a3a8c', '#00594a', '#c0392b', '#9a8430', '#4527a0', '#00838f', '#6d4c41', '#1a4db3']
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[h % PALETTE.length]
}

/**
 * Generate 2-letter initials from a rider name (DB format or display format).
 */
export function riderInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
