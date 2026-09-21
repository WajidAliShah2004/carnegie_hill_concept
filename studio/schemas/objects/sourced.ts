import {defineField, defineType} from 'sanity'
import type {ComponentType} from 'react'
import type {ObjectInputProps} from 'sanity'

/**
 * Sourced text.
 *
 * Nothing about the business goes on the website unless we can say where it
 * came from. Every sentence is stored as { text, source: { kind, detail } }
 * and the source is required, so a statement cannot be published without one.
 *
 * The shape here must stay identical to the Sourced type in site/.
 */

export const SOURCE_KINDS = [
  {value: 'liveSite', title: 'Copied from the current website'},
  {value: 'ownerWritten', title: 'Written by the owner or the family'},
  {value: 'reviewUrl', title: 'From a real customer review'},
  {value: 'observedInPhoto', title: 'Plainly visible in a photo'},
] as const

export type SourceKind = (typeof SOURCE_KINDS)[number]['value']

const DETAIL_HELP =
  'Say exactly where. The page it was copied from, the date the owner wrote it, the link to the review, or the file name of the photo.'

export const textSource = defineType({
  name: 'textSource',
  title: 'Where this came from',
  type: 'object',
  fields: [
    defineField({
      name: 'kind',
      title: 'Kind of source',
      type: 'string',
      options: {list: SOURCE_KINDS.map((k) => ({value: k.value, title: k.title}))},
      validation: (Rule) => Rule.required().error('Pick where this text came from.'),
    }),
    defineField({
      name: 'detail',
      title: 'Which page, date, link, or photo',
      type: 'string',
      description: DETAIL_HELP,
      validation: (Rule) =>
        Rule.required().error('Say which page, date, link, or photo this came from.'),
    }),
  ],
})

type SourcedOptions = {
  /** Schema type name, for example sourcedLine. */
  name: string
  title: string
  /** true gives a text area, false gives a single line input. */
  multiline: boolean
  /** Fixed source kind, hidden from the editor when set. */
  fixedKind?: SourceKind
  /** Replace the whole input, used for the owner's photo caption. */
  input?: ComponentType<ObjectInputProps>
  /** Skip the required source check. Only for fields the Studio fills in itself. */
  sourceOptional?: boolean
  textDescription?: string
}

/** Builds one sourced object type. Used for the single line and multi line variants. */
export function defineSourced(options: SourcedOptions) {
  const {name, title, multiline, fixedKind, input, sourceOptional, textDescription} = options

  return defineType({
    name,
    title,
    type: 'object',
    ...(input ? {components: {input}} : {}),
    fieldsets: [
      {
        name: 'source',
        title: 'Where this came from',
        description: 'Filled in by the family or the agency. The website never shows it.',
        options: {collapsible: true, collapsed: true},
      },
    ],
    fields: [
      defineField({
        name: 'text',
        title: 'Text',
        type: multiline ? 'text' : 'string',
        ...(multiline ? {rows: 6} : {}),
        ...(textDescription ? {description: textDescription} : {}),
      }),
      defineField({
        name: 'source',
        title: 'Where this came from',
        type: 'textSource',
        fieldset: 'source',
        initialValue: fixedKind ? {kind: fixedKind} : undefined,
        validation: (Rule) =>
          sourceOptional
            ? Rule.optional()
            : Rule.custom((value: {kind?: string; detail?: string} | undefined, context) => {
                const parent = context.parent as {text?: string} | undefined
                const hasText = Boolean(parent?.text && parent.text.trim())
                if (!hasText) return true
                if (!value || !value.kind || !value.detail) {
                  return 'Every sentence needs a source. Open "Where this came from" and fill it in.'
                }
                return true
              }),
      }),
    ],
    preview: {
      select: {text: 'text', kind: 'source.kind'},
      prepare({text, kind}: {text?: string; kind?: string}) {
        return {
          title: text || 'Empty',
          subtitle: kind ? SOURCE_KINDS.find((k) => k.value === kind)?.title : 'No source yet',
        }
      },
    },
  })
}

/** One line of sourced text, for headings and short statements. */
export const sourcedLine = defineSourced({
  name: 'sourcedLine',
  title: 'Sourced line',
  multiline: false,
})

/** Several lines of sourced text, for paragraphs and quotes. */
export const sourcedText = defineSourced({
  name: 'sourcedText',
  title: 'Sourced text',
  multiline: true,
})
