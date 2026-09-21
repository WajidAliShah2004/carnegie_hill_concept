/**
 * The matcher behind `check-strings` and `check-jsonld`.
 *
 * A string found on the built page passes when, after whitespace is
 * normalised, it is an allowed string, or it can be cut end to end into
 * allowed strings separated only by punctuation, separators, and digits.
 * Nothing else passes. An invented sentence fails because at least one run of
 * its words is in neither the content nor `labels.ts`.
 */

/** Collapse runs of whitespace, including non-breaking space, to one space. */
export function normalise(value) {
  return String(value ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Characters allowed to sit between two allowed strings, plus digits. */
const FILLER = /^[\s,.:;!?|/\\()[\]{}<>"'‘’“”…·•&+*#%@~^=_–‐-]+/

const DIGITS = /^\d+/

/**
 * Strings the check never judges: URLs, email addresses, phone hrefs,
 * schema.org type and property tokens, ISO dates and times, and bare numbers.
 */
export function isExempt(value) {
  const text = normalise(value)
  if (text === '') return true
  if (/^https?:\/\//i.test(text)) return true
  if (/^(mailto|tel|sms|geo):/i.test(text)) return true
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return true
  if (/^\+?[\d\s().-]{7,}$/.test(text)) return true
  if (/^https?:\/\/schema\.org/i.test(text)) return true
  if (/^#[A-Za-z][\w-]*$/.test(text)) return true
  if (/^\d{4}-\d{2}-\d{2}(T[\d:.+Z-]*)?$/.test(text)) return true
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) return true
  if (/^[\d\s.,%+-]+$/.test(text)) return true
  // Single schema.org vocabulary words, e.g. Store, PostalAddress, Monday.
  return false
}

/** Index the allowed set by first character, longest first, for the cutter. */
export function buildIndex(allowed) {
  const byFirst = new Map()
  for (const raw of allowed) {
    const value = normalise(raw)
    if (value === '') continue
    const first = value[0]
    if (!byFirst.has(first)) byFirst.set(first, [])
    byFirst.get(first).push(value)
  }
  for (const list of byFirst.values()) list.sort((a, b) => b.length - a.length)
  return { byFirst, set: new Set([...allowed].map(normalise)) }
}

/**
 * Can `text` be cut end to end into allowed strings and filler?
 *
 * Depth-first with a visited set, longest match first, so a line built from
 * several fields ("Monday to Saturday, 10:00 AM to 7:30 PM") passes while an
 * invented sentence does not.
 */
export function segments(text, index) {
  const value = normalise(text)
  if (value === '') return true
  if (index.set.has(value)) return true

  const failed = new Set()

  const walk = (position) => {
    if (position >= value.length) return true
    if (failed.has(position)) return false

    const rest = value.slice(position)

    const filler = FILLER.exec(rest)
    if (filler && walk(position + filler[0].length)) return true

    const digits = DIGITS.exec(rest)
    if (digits && walk(position + digits[0].length)) return true

    for (const candidate of index.byFirst.get(rest[0]) ?? []) {
      if (!rest.startsWith(candidate)) continue
      if (walk(position + candidate.length)) return true
    }

    failed.add(position)
    return false
  }

  return walk(0)
}

/** One decision for one found string. */
export function judge(text, index) {
  const value = normalise(text)
  if (value === '') return { ok: true, reason: 'empty' }
  if (isExempt(value)) return { ok: true, reason: 'exempt' }
  if (index.set.has(value)) return { ok: true, reason: 'exact' }
  if (segments(value, index)) return { ok: true, reason: 'composed' }
  return { ok: false, reason: 'not in content or labels' }
}
