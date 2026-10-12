import {useEffect, useRef} from 'react'
import {set, unset, type ObjectInputProps} from 'sanity'

type CaptionValue = {
  text?: string
  source?: {kind?: string; detail?: string}
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * The caption input the owner sees.
 *
 * He gets one plain box to type in. The source underneath is filled in for him
 * with "written by the owner" and today's date, and it is cleared again if he
 * empties the box, so a caption can never end up on the site without a source.
 *
 * A caption that was already there keeps the source it came with until its
 * words change. Otherwise opening a photo the agency captioned from what the
 * photo shows would record the owner as the author of words he never wrote.
 */
export function OwnerCaptionInput(props: ObjectInputProps) {
  const {onChange, members} = props
  const value = props.value as CaptionValue | undefined
  const text = (value?.text || '').trim()
  const kind = value?.source?.kind
  const detail = value?.source?.detail
  const textWhenOpened = useRef(text)

  useEffect(() => {
    if (text) {
      if (text === textWhenOpened.current && kind && detail) return
      if (kind !== 'ownerWritten' || !detail) {
        onChange(
          set({kind: 'ownerWritten', detail: `Typed by the owner in the Studio on ${today()}`}, [
            'source',
          ]),
        )
      }
      return
    }
    if (kind || detail) {
      onChange(unset(['source']))
    }
  }, [text, kind, detail, onChange])

  const textOnly = members.filter((member) => member.kind === 'field' && member.name === 'text')

  return props.renderDefault({...props, members: textOnly})
}
