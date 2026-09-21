import {Card, Text} from '@sanity/ui'
import {useFormValue, type StringInputProps} from 'sanity'
import {platformFromUrl, platformTitle} from '../lib/platformFromUrl'

/**
 * Shows which site the link belongs to.
 *
 * Display only. Nothing is written to the document: the field is read only,
 * the GROQ query in site/ does not select it, and the site works the platform
 * out from the link itself. One rule, one place it is applied, so a stored
 * value can never disagree with the link.
 */
export function DerivedPlatformInput(_props: StringInputProps) {
  const url = useFormValue(['url']) as string | undefined
  const derived = platformFromUrl(url)

  return (
    <Card padding={3} radius={2} tone={derived ? 'transparent' : 'caution'} border>
      <Text size={1} muted={!derived}>
        {derived ? platformTitle(derived) : 'Paste the link above and this fills in by itself.'}
      </Text>
    </Card>
  )
}
