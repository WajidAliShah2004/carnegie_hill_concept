import {defineField, defineType} from 'sanity'
import {CommentIcon} from '@sanity/icons/Comment'
import {orderRankField} from '@sanity/orderable-document-list'

/**
 * A customer review.
 *
 * There is no rating field here and there must never be one. The site does not
 * publish star ratings or an average score.
 */
export const review = defineType({
  name: 'review',
  title: 'Reviews',
  type: 'document',
  icon: CommentIcon,
  fields: [
    defineField({
      name: 'quote',
      title: 'What the customer wrote',
      type: 'sourcedText',
      description:
        'Paste the review exactly as it appears, including any spelling mistakes. If you shorten it, keep one unbroken run of the original and do not join separate parts together.',
      initialValue: {source: {kind: 'reviewUrl'}},
      validation: (Rule) => Rule.required().error('Paste the review text.'),
    }),
    defineField({
      name: 'displayName',
      title: 'Name shown on the review',
      type: 'string',
      description: 'The name exactly as the review site shows it.',
      validation: (Rule) => Rule.required().error('Add the name shown on the review.'),
    }),
    defineField({
      name: 'platform',
      title: 'Where the review is',
      type: 'string',
      options: {
        list: [
          {value: 'google', title: 'Google'},
          {value: 'yelp', title: 'Yelp'},
          {value: 'other', title: 'Somewhere else'},
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required().error('Say where the review is.'),
    }),
    defineField({
      name: 'sourceUrl',
      title: 'Link to the review',
      type: 'url',
      description: 'The link anyone can open to read the review on the review site.',
      validation: (Rule) =>
        Rule.required()
          .uri({scheme: ['http', 'https']})
          .error('Add the link to the review.'),
    }),
    defineField({
      name: 'date',
      title: 'Date on the review',
      type: 'date',
      description: 'Only fill this in if the review site shows a date. Otherwise leave it empty.',
      options: {dateFormat: 'YYYY-MM-DD'},
    }),
    defineField({
      name: 'featured',
      title: 'Show on the front page',
      type: 'boolean',
      initialValue: false,
    }),
    orderRankField({type: 'review'}),
  ],
  preview: {
    select: {quote: 'quote.text', name: 'displayName', platform: 'platform', featured: 'featured'},
    prepare({
      quote,
      name,
      platform,
      featured,
    }: {
      quote?: string
      name?: string
      platform?: string
      featured?: boolean
    }) {
      const parts = [platform, featured ? 'on the front page' : null].filter(Boolean)
      return {
        title: name || 'No name yet',
        subtitle: [quote, parts.join(', ')].filter(Boolean).join(' | '),
      }
    },
  },
})
