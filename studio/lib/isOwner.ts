import type {CurrentUser} from 'sanity'
import {ownerEmails} from './env'

/**
 * Is this the shop owner?
 *
 * Read the limits of this in README.md. It decides which desk a person sees.
 * It is not a lock. Sanity's own roles decide what a person can actually write.
 */
export function isOwnerUser(currentUser: CurrentUser | null | undefined): boolean {
  if (!currentUser || ownerEmails.length === 0) return false
  const email = (currentUser.email || '').toLowerCase()
  return email.length > 0 && ownerEmails.includes(email)
}
