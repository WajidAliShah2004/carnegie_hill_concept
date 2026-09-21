import {useDocumentOperation, type DocumentActionComponent, type DocumentActionsResolver} from 'sanity'
import {OWNER_TYPES, SINGLETON_TYPES} from '../schemas'
import {isOwnerUser} from './isOwner'

/** Actions that would make a second copy of a one of a kind document. */
const SINGLETON_BANNED = new Set(['duplicate', 'delete', 'unpublish'])

/** Actions the owner never needs. */
const OWNER_BANNED = new Set(['duplicate'])

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

type PhotoDraft = {caption?: {text?: string; source?: {kind?: string; detail?: string}}} | null

/**
 * Safety net on Publish for photos.
 *
 * The caption input already writes the source as the owner types. This makes
 * sure of it one more time at the moment of publishing, so a caption can never
 * reach the site without a source, and an empty caption is removed rather than
 * left behind as an empty object.
 */
function withCaptionSource(action: DocumentActionComponent): DocumentActionComponent {
  const Wrapped: DocumentActionComponent = (props) => {
    const original = action(props)
    const {patch} = useDocumentOperation(props.id, props.type)
    if (!original) return original

    return {
      ...original,
      onHandle: () => {
        const draft = props.draft as PhotoDraft
        const text = (draft?.caption?.text || '').trim()
        if (text) {
          const source = draft?.caption?.source
          if (source?.kind !== 'ownerWritten' || !source?.detail) {
            patch.execute([
              {
                set: {
                  'caption.source': {
                    kind: 'ownerWritten',
                    detail: `Typed by the owner in the Studio on ${today()}`,
                  },
                },
              },
            ])
          }
        } else if (draft?.caption) {
          patch.execute([{unset: ['caption']}])
        }
        original.onHandle?.()
      },
    }
  }
  Wrapped.action = action.action
  return Wrapped
}

function mapPhotoActions(actions: DocumentActionComponent[]): DocumentActionComponent[] {
  return actions.map((action) => (action.action === 'publish' ? withCaptionSource(action) : action))
}

/** Full Studio: the family and the agency. */
export const fullDocumentActions: DocumentActionsResolver = (prev, context) => {
  if (isOwnerUser(context.currentUser)) return ownerDocumentActions(prev, context)
  const actions = context.schemaType === 'photo' ? mapPhotoActions(prev) : prev
  if (SINGLETON_TYPES.has(context.schemaType)) {
    return actions.filter((action) => !SINGLETON_BANNED.has(String(action.action)))
  }
  return actions
}

/** Owner desk: photos only, and nothing that could confuse. */
export const ownerDocumentActions: DocumentActionsResolver = (prev, context) => {
  if (!OWNER_TYPES.has(context.schemaType)) return []
  return mapPhotoActions(prev).filter((action) => !OWNER_BANNED.has(String(action.action)))
}
