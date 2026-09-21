import {defineField, defineType} from 'sanity'
import {TagIcon} from '@sanity/icons/Tag'
import {orderRankField} from '@sanity/orderable-document-list'
import {PHOTO_TYPES} from '../photoTypes'

export const service = defineType({
  name: 'service',
  title: 'Services',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Name of the service',
      type: 'sourcedLine',
      validation: (Rule) => Rule.required().error('Add the name of the service.'),
    }),
    defineField({
      name: 'anchor',
      title: 'Short name used in the web address',
      type: 'string',
      description: 'Small letters, numbers, and dashes only. For example: repair-and-restoration.',
      validation: (Rule) =>
        Rule.required()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {name: 'small letters, numbers, and dashes'})
          .error('Use small letters, numbers, and dashes only.'),
    }),
    defineField({
      name: 'body',
      title: 'Description',
      type: 'sourcedText',
      description: 'Only words that already appear on the current website or that the owner wrote.',
    }),
    defineField({
      name: 'image',
      title: 'Picture',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'galleryType',
      title: 'Gallery tab this links to',
      type: 'string',
      description: 'Leave empty if this service has no matching gallery tab.',
      options: {list: PHOTO_TYPES.map((t) => ({value: t.value, title: t.title}))},
    }),
    orderRankField({type: 'service'}),
  ],
  preview: {
    select: {title: 'title.text', anchor: 'anchor', media: 'image'},
    prepare({title, anchor, media}: {title?: string; anchor?: string; media?: unknown}) {
      return {title: title || 'No name yet', subtitle: anchor, media: media as never}
    },
  },
})
