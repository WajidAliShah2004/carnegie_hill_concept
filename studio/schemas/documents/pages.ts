import {defineField, defineType} from 'sanity'
import {DocumentIcon} from '@sanity/icons/Document'

/**
 * One block of text on a page. `key` tells site/ where the block belongs.
 */
export const pageSection = defineType({
  name: 'pageSection',
  title: 'Section',
  type: 'object',
  fields: [
    defineField({
      name: 'key',
      title: 'Which part of the page',
      type: 'string',
      description: 'Small letters and dashes. The site uses this to place the text.',
      validation: (Rule) =>
        Rule.required()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {name: 'small letters, numbers, and dashes'})
          .error('Use small letters, numbers, and dashes only.'),
    }),
    /**
     * A heading on a statement page can itself be a statement, so it is
     * sourced text like every other sentence. site/ reads it as Sourced.
     */
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'sourcedLine',
      description: 'Leave empty if this part of the page has no heading.',
    }),
    defineField({
      name: 'paragraphs',
      title: 'Paragraphs',
      type: 'array',
      of: [{type: 'sourcedText'}],
      validation: (Rule) => Rule.required().min(1).error('Add at least one paragraph.'),
    }),
  ],
  preview: {
    select: {key: 'key', heading: 'heading.text', count: 'paragraphs'},
    prepare({key, heading, count}: {key?: string; heading?: string; count?: unknown[]}) {
      const n = Array.isArray(count) ? count.length : 0
      return {
        title: heading || key || 'No heading',
        subtitle: `${n} paragraph${n === 1 ? '' : 's'}`,
      }
    },
  },
})

type PageDefinition = {name: string; title: string; headingOptional?: boolean}

/**
 * `headingOptional` marks the two pages whose visible H1 is an interface word
 * from site/src/labels.ts, not a statement about the shop:
 *
 *   - Reviews uses "Selected customer reviews" (spec section 8)
 *   - Privacy uses "Privacy notice"
 *
 * Neither wording exists on the live site, so there is nothing to source, and
 * requiring an H1 here would only invite somebody to write one. site/ already
 * falls back to `labels.pageHeading[...]` when `h1` is empty. Fill it in only
 * if the owner supplies wording of his own.
 */
export const PAGE_TYPES: PageDefinition[] = [
  {name: 'homePage', title: 'Home page'},
  {name: 'aboutPage', title: 'About page'},
  {name: 'servicesPage', title: 'Services page'},
  {name: 'galleryPage', title: 'Gallery page'},
  {name: 'reviewsPage', title: 'Reviews page', headingOptional: true},
  {name: 'contactPage', title: 'Contact page'},
  {name: 'privacyPage', title: 'Privacy page', headingOptional: true},
]

function definePage({name, title, headingOptional}: PageDefinition) {
  return defineType({
    name,
    title,
    type: 'document',
    icon: DocumentIcon,
    fields: [
      defineField({
        name: 'h1',
        title: 'Main heading',
        type: 'sourcedLine',
        ...(headingOptional
          ? {
              description:
                'Leave this empty unless the owner writes a heading of his own. The website uses its own wording for this page.',
            }
          : {}),
        validation: (Rule) =>
          headingOptional ? Rule.optional() : Rule.required().error('Add the main heading.'),
      }),
      defineField({
        name: 'intro',
        title: 'Opening sentence',
        type: 'sourcedText',
      }),
      defineField({
        name: 'metaTitle',
        title: 'Title shown in search results',
        type: 'sourcedLine',
        validation: (Rule) => Rule.required().error('Add the title shown in search results.'),
      }),
      defineField({
        name: 'metaDescription',
        title: 'Description shown in search results',
        type: 'sourcedText',
      }),
      defineField({
        name: 'sections',
        title: 'Sections',
        type: 'array',
        of: [{type: 'pageSection'}],
      }),
    ],
    preview: {
      select: {h1: 'h1.text'},
      prepare({h1}: {h1?: string}) {
        return {title, subtitle: h1}
      },
    },
  })
}

export const pages = PAGE_TYPES.map(definePage)
