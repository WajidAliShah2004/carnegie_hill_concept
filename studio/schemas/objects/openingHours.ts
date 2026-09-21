import {defineField, defineType} from 'sanity'

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

/**
 * One row of opening hours, for example Monday to Saturday, 10:00 AM to 7:30 PM.
 *
 * Only the days the shop is reliably open go in here. Sunday is described in the
 * Sunday note instead, because the current website contradicts itself about it.
 */
export const openingHours = defineType({
  name: 'openingHours',
  title: 'Opening hours',
  type: 'object',
  fields: [
    defineField({
      name: 'days',
      title: 'Days',
      type: 'array',
      of: [{type: 'string'}],
      options: {list: WEEKDAYS.map((day) => ({value: day, title: day}))},
      validation: (Rule) => Rule.required().min(1).error('Tick at least one day.'),
    }),
    defineField({
      name: 'opens',
      title: 'Opens',
      type: 'string',
      description: 'Written the way the shop writes it, for example 10:00 AM.',
      validation: (Rule) => Rule.required().error('Say what time it opens.'),
    }),
    defineField({
      name: 'closes',
      title: 'Closes',
      type: 'string',
      description: 'Written the way the shop writes it, for example 7:30 PM.',
      validation: (Rule) => Rule.required().error('Say what time it closes.'),
    }),
  ],
  preview: {
    select: {days: 'days', opens: 'opens', closes: 'closes'},
    prepare({days, opens, closes}: {days?: string[]; opens?: string; closes?: string}) {
      return {
        title: Array.isArray(days) && days.length ? days.join(', ') : 'No days yet',
        subtitle: opens && closes ? `${opens} to ${closes}` : '',
      }
    },
  },
})
