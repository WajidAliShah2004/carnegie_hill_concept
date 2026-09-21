import {defineField, defineType} from 'sanity'
import {LinkIcon} from '@sanity/icons/Link'
import {orderRankField} from '@sanity/orderable-document-list'
import {SOCIAL_PLATFORMS, platformFromUrl, platformTitle} from '../../lib/platformFromUrl'
import {DerivedPlatformInput} from '../../components/DerivedPlatformInput'

export const socialPost = defineType({
  name: 'socialPost',
  title: 'Social posts',
  type: 'document',
  icon: LinkIcon,
  fields: [
    defineField({
      name: 'url',
      title: 'Link to the post',
      type: 'url',
      description:
        'Paste the link to one post on Instagram, Facebook, YouTube, Twitter, or LinkedIn. A video that ships with the site is entered by the agency as /video/name.mp4.',
      validation: (Rule) =>
        Rule.required()
          .uri({scheme: ['http', 'https'], allowRelative: true})
          .error('Paste the link to the post.'),
    }),
    defineField({
      name: 'platform',
      title: 'Which site this is on',
      type: 'string',
      description: 'Worked out from the link. It cannot be set by hand.',
      // Display only. The site derives the platform from the URL and the GROQ
      // query does not select this field, so a stored value is never read.
      // It exists so an editor can see what the link was understood as.
      readOnly: true,
      options: {list: SOCIAL_PLATFORMS.map((p) => ({value: p.value, title: p.title}))},
      components: {input: DerivedPlatformInput},
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'sourcedLine',
      description: 'Only if the post itself says it, or the owner wrote it.',
    }),
    defineField({
      name: 'featured',
      title: 'Show on the front page',
      type: 'boolean',
      initialValue: false,
    }),
    orderRankField({type: 'socialPost'}),
  ],
  preview: {
    // The platform is read off the link here too, so the list and the form
    // can never disagree.
    select: {url: 'url', featured: 'featured'},
    prepare({url, featured}: {url?: string; featured?: boolean}) {
      return {
        title: platformTitle(platformFromUrl(url)) || 'No link yet',
        subtitle: [url, featured ? 'on the front page' : null].filter(Boolean).join(' | '),
      }
    },
  },
})
