import {defineField, defineType} from 'sanity'
import {SOCIAL_PLATFORMS, platformTitle} from '../../lib/platformFromUrl'

export const socialLink = defineType({
  name: 'socialLink',
  title: 'Social link',
  type: 'object',
  fields: [
    defineField({
      name: 'platform',
      title: 'Which site',
      type: 'string',
      options: {list: SOCIAL_PLATFORMS.map((p) => ({value: p.value, title: p.title}))},
      validation: (Rule) => Rule.required().error('Pick a site.'),
    }),
    defineField({
      name: 'url',
      title: 'Link to the profile',
      type: 'url',
      validation: (Rule) =>
        Rule.required()
          .uri({scheme: ['http', 'https']})
          .error('Add the link to the profile.'),
    }),
    defineField({
      name: 'confirmed',
      title: 'Confirmed',
      type: 'boolean',
      description: 'Only tick once the owner confirms he controls this profile.',
      initialValue: false,
    }),
  ],
  preview: {
    select: {platform: 'platform', url: 'url', confirmed: 'confirmed'},
    prepare({platform, url, confirmed}: {platform?: string; url?: string; confirmed?: boolean}) {
      return {
        title: platformTitle(platform) || 'No site yet',
        subtitle: `${url || ''}${confirmed ? '' : ' (not confirmed, so it stays off the site)'}`,
      }
    },
  },
})
