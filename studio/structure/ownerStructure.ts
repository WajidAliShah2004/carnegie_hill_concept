import type {StructureResolver} from 'sanity/structure'
import {orderableDocumentListDeskItem} from '@sanity/orderable-document-list'
import {ImageIcon} from '@sanity/icons/Image'

/**
 * The owner's desk. One item, Photos, and nothing else.
 *
 * The list is drag to order, so the order on the site is the order he sets here.
 */
export const ownerStructure: StructureResolver = (S, context) =>
  S.list()
    .title('Photos')
    .items([
      orderableDocumentListDeskItem({
        type: 'photo',
        title: 'Photos',
        icon: ImageIcon,
        S,
        context,
      }),
    ])
