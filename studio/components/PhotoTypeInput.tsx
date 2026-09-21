import {Button, Stack} from '@sanity/ui'
import {set, unset, type StringInputProps} from 'sanity'
import {PHOTO_TYPES} from '../schemas/photoTypes'

/**
 * Four big buttons instead of a dropdown.
 *
 * The owner does this on a phone, so every button is full width and taller than
 * the 48 pixel minimum for a comfortable tap.
 */
export function PhotoTypeInput(props: StringInputProps) {
  const {onChange, value, readOnly} = props

  return (
    <Stack gap={2}>
      {PHOTO_TYPES.map((option) => {
        const selected = value === option.value
        return (
          <Button
            key={option.value}
            aria-pressed={selected}
            disabled={readOnly}
            mode={selected ? 'default' : 'ghost'}
            tone={selected ? 'primary' : 'default'}
            onClick={() => onChange(selected ? unset() : set(option.value))}
            text={option.title}
            style={{minHeight: '56px', width: '100%'}}
          />
        )
      })}
    </Stack>
  )
}
