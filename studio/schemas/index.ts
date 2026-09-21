import type {SchemaTypeDefinition} from 'sanity'
import {sourcedLine, sourcedText, textSource} from './objects/sourced'
import {openingHours} from './objects/openingHours'
import {socialLink} from './objects/socialLink'
import {ownerCaption, photo} from './documents/photo'
import {review} from './documents/review'
import {socialPost} from './documents/socialPost'
import {service} from './documents/service'
import {businessInfo} from './documents/businessInfo'
import {PAGE_TYPES, pageSection, pages} from './documents/pages'

/** Document types that may only ever have one document. */
export const SINGLETON_TYPES = new Set<string>([
  'businessInfo',
  ...PAGE_TYPES.map((page) => page.name),
])

/** Document types the owner is allowed to touch. */
export const OWNER_TYPES = new Set<string>(['photo'])

export const schemaTypes: SchemaTypeDefinition[] = [
  textSource,
  sourcedLine,
  sourcedText,
  ownerCaption,
  openingHours,
  socialLink,
  pageSection,
  photo,
  review,
  socialPost,
  service,
  businessInfo,
  ...pages,
]

export {PAGE_TYPES}
