import type {ListItem, StructureResolver} from 'sanity/structure'
import {orderableDocumentListDeskItem} from '@sanity/orderable-document-list'
import {ImageIcon} from '@sanity/icons/Image'

/**
 * The drag to order plugin heads its list with the document type's title,
 * which for photos is the singular "Photo" so a new one reads "New Photo".
 * This gives the list its plural heading back. The plugin hands back a
 * finished list item, so the heading is replaced on its child.
 */
export function withListTitle(item: ListItem, title: string): ListItem {
  const child = item.child
  if (!child || typeof child !== 'object') return item
  return {...item, child: {...child, title} as ListItem['child']}
}

/**
 * The owner's desk. One item, Photos, and nothing else.
 *
 * The list is drag to order, so the order on the site is the order he sets here.
 */
export const ownerStructure: StructureResolver = (S, context) =>
  S.list()
    .title('Photos')
    .items([
      withListTitle(
        orderableDocumentListDeskItem({
          type: 'photo',
          title: 'Photos',
          icon: ImageIcon,
          S,
          context,
        }),
        'Photos',
      ),
    ])
