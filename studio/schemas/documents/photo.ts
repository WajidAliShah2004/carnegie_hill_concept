import {defineField, defineType} from 'sanity'
import {ImageIcon} from '@sanity/icons/Image'
import {orderRankField} from '@sanity/orderable-document-list'
import {PHOTO_TYPES, PHOTO_TYPE_TITLES} from '../photoTypes'
import {OwnerCaptionInput} from '../../components/OwnerCaptionInput'
import {PhotoTypeInput} from '../../components/PhotoTypeInput'
import {defineSourced} from '../objects/sourced'

/**
 * The caption on a photo. Same shape as every other sourced field, but the
 * source is filled in by the Studio so the owner only ever sees the text box.
 */
export const ownerCaption = defineSourced({
  name: 'ownerCaption',
  title: 'Caption',
  multiline: true,
  fixedKind: 'ownerWritten',
  input: OwnerCaptionInput,
  sourceOptional: true,
  textDescription:
    'Only if you want one. Say what is in the picture in your own words. This is also read out to people who cannot see the photo.',
})

export const photo = defineType({
  name: 'photo',
  // Singular, so a new one is headed "New Photo". The lists are titled
  // "Photos" in the structure files.
  title: 'Photo',
  type: 'document',
  icon: ImageIcon,
  fields: [
    defineField({
      name: 'image',
      title: 'Photo',
      type: 'image',
      description: 'Take a photo or choose one from your phone.',
      options: {hotspot: true, accept: 'image/*', storeOriginalFilename: true},
      validation: (Rule) => Rule.required().error('Add a photo.'),
    }),
    defineField({
      name: 'type',
      title: 'What kind of photo is this?',
      type: 'string',
      description: 'Tap one.',
      options: {list: PHOTO_TYPES.map((t) => ({value: t.value, title: t.title})), layout: 'radio'},
      components: {input: PhotoTypeInput},
      validation: (Rule) => Rule.required().error('Tap one of the four buttons.'),
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'ownerCaption',
    }),
    defineField({
      name: 'onHomeSlider',
      title: 'Show on the front page slider',
      type: 'boolean',
      description: 'Leave this off unless you want it on the front page.',
      initialValue: false,
    }),
    orderRankField({type: 'photo', newItemPosition: 'before'}),
    // Set only by scripts/stand-in-photos.mjs. Shown only on a photo that has it.
    defineField({
      name: 'standIn',
      title: 'Stand-in copy',
      type: 'boolean',
      readOnly: true,
      hidden: ({value}) => !value,
      description:
        'A reduced copy from the old website, put here for testing. The live site will not build while any photo has this. Delete the photo once the original is uploaded.',
    }),
  ],
  preview: {
    select: {
      media: 'image',
      type: 'type',
      caption: 'caption.text',
      onHomeSlider: 'onHomeSlider',
      standIn: 'standIn',
    },
    prepare({
      media,
      type,
      caption,
      onHomeSlider,
      standIn,
    }: {
      media?: unknown
      type?: string
      caption?: string
      onHomeSlider?: boolean
      standIn?: boolean
    }) {
      const typeTitle = type ? PHOTO_TYPE_TITLES[type] || type : 'No type yet'
      const slider = onHomeSlider ? 'On the front page slider' : 'Not on the slider'
      const subtitle = caption ? `${typeTitle}. ${slider}.` : slider
      return {
        title: caption || typeTitle,
        subtitle: standIn ? `Stand-in. ${subtitle}` : subtitle,
        media: media as never,
      }
    },
  },
})
