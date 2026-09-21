/**
 * Validate and strip `Sourced` values.
 *
 * Every statement about the business carries a private source. This module is
 * the only place that reads it. It throws when a source is missing so the
 * build fails loudly, naming the document and the field, rather than shipping
 * a sentence nobody can trace.
 */

import type { Sourced, SourceKind } from './types'

const KINDS: readonly SourceKind[] = ['liveSite', 'ownerWritten', 'reviewUrl', 'observedInPhoto']

export class MissingSourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingSourceError'
  }
}

function fail(documentId: string, field: string, reason: string): never {
  throw new MissingSourceError(
    `Unsourced content in document "${documentId}", field "${field}": ${reason}. ` +
      `Every statement about the business needs a source (see docs/copy-sources.md). ` +
      `Remove the text or record where it came from. Never fill the gap.`,
  )
}

/** Validate a required sourced value and return its plain text. */
export function text(value: Sourced | null | undefined, documentId: string, field: string): string {
  if (!value || typeof value !== 'object') fail(documentId, field, 'the field is missing')
  const body = typeof value.text === 'string' ? value.text.trim() : ''
  if (body === '') fail(documentId, field, 'the text is empty')
  const source = value.source
  if (!source || typeof source !== 'object') fail(documentId, field, 'there is no source object')
  if (!KINDS.includes(source.kind)) {
    fail(documentId, field, `source.kind "${String(source.kind)}" is not one of ${KINDS.join(', ')}`)
  }
  if (typeof source.detail !== 'string' || source.detail.trim() === '') {
    fail(documentId, field, 'source.detail is empty, so the text cannot be traced')
  }
  return body
}

/**
 * Validate an optional sourced value. Absent means absent: the caller must not
 * render anything. Present but unsourced still fails the build.
 */
export function optionalText(
  value: Sourced | null | undefined,
  documentId: string,
  field: string,
): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'object' && (!value.text || value.text.trim() === '')) return undefined
  return text(value, documentId, field)
}

/** Validate a list of sourced values, dropping nothing and failing on any gap. */
export function textList(
  values: readonly (Sourced | null | undefined)[] | null | undefined,
  documentId: string,
  field: string,
): string[] {
  if (!values) return []
  return values.map((value, index) => text(value, documentId, `${field}[${index}]`))
}
