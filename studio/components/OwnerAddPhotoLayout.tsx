import {Button} from '@sanity/ui'
import {useWorkspace, type LayoutProps} from 'sanity'
import {useRouterState, type RouterState} from 'sanity/router'
import {AddIcon} from '@sanity/icons/Add'

/**
 * The owner's desk is two panes deep: the photo list, then one photo. A second
 * pane group means a photo is open, and its Publish button sits at the bottom
 * of the screen, exactly where the Add photo bar would cover it on a phone.
 */
function photoIsOpen(state: RouterState): boolean {
  const toolState = state[String(state.tool)] as {panes?: unknown[]} | undefined
  return (toolState?.panes?.length ?? 0) >= 2
}

/**
 * Puts one large Add photo button across the bottom of the owner's screen,
 * so the thing he came to do is always the biggest thing on the page. It steps
 * aside while a photo is open, so Publish is the biggest thing instead.
 */
export function OwnerAddPhotoLayout(props: LayoutProps) {
  const {basePath} = useWorkspace()
  const editing = useRouterState(photoIsOpen)
  const base = basePath === '/' ? '' : basePath
  const href = `${base}/intent/create/template=photo;type=photo/`

  return (
    <>
      {props.renderDefault(props)}
      <div
        hidden={editing}
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
