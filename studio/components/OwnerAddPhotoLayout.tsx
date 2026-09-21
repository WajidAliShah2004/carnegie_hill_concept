import {Button} from '@sanity/ui'
import {useWorkspace, type LayoutProps} from 'sanity'
import {AddIcon} from '@sanity/icons/Add'

/**
 * Puts one large Add photo button across the bottom of the owner's screen,
 * so the thing he came to do is always the biggest thing on the page.
 */
export function OwnerAddPhotoLayout(props: LayoutProps) {
  const {basePath} = useWorkspace()
  const base = basePath === '/' ? '' : basePath
  const href = `${base}/intent/create/template=photo;type=photo/`

  return (
    <>
      {props.renderDefault(props)}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '12px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          zIndex: 1000,
          pointerEvents: 'none',
        }}
      >
        <Button
          as="a"
          href={href}
          icon={AddIcon}
          text="Add photo"
          tone="primary"
          fontSize={3}
          style={{width: '100%', minHeight: '64px', pointerEvents: 'auto'}}
        />
      </div>
    </>
  )
}
