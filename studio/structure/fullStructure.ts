import type {StructureResolver} from 'sanity/structure'
import {orderableDocumentListDeskItem} from '@sanity/orderable-document-list'
import {CogIcon} from '@sanity/icons/Cog'
import {DocumentIcon} from '@sanity/icons/Document'
import {ImageIcon} from '@sanity/icons/Image'
import {PAGE_TYPES} from '../schemas'
import {PHOTO_TYPES} from '../schemas/photoTypes'
import {withListTitle} from './ownerStructure'

/**
 * The desk the family and the agency see. Everything, in the order they work in.
 */
export const fullStructure: StructureResolver = (S, context) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Photos')
        .icon(ImageIcon)
        .child(
          S.list()
            .title('Photos')
            .items([
              withListTitle(
                orderableDocumentListDeskItem({
                  type: 'photo',
                  title: 'All photos, drag to order',
                  icon: ImageIcon,
                  S,
                  context,
                }),
                'All photos',
              ),
              S.divider(),
              ...PHOTO_TYPES.map((type) =>
                S.listItem()
                  .title(type.title)
                  .id(`photos-${type.value}`)
                  .icon(ImageIcon)
                  .child(
                    S.documentTypeList('photo')
                      .title(type.title)
                      .filter('_type == "photo" && type == $type')
                      .params({type: type.value})
                      .defaultOrdering([{field: 'orderRank', direction: 'asc'}]),
                  ),
              ),
              S.divider(),
              S.listItem()
                .title('On the front page slider')
                .id('photos-on-slider')
                .icon(ImageIcon)
                .child(
                  S.documentTypeList('photo')
                    .title('On the front page slider')
                    .filter('_type == "photo" && onHomeSlider == true')
                    .defaultOrdering([{field: 'orderRank', direction: 'asc'}]),
                ),
            ]),
        ),
      S.divider(),
      orderableDocumentListDeskItem({type: 'review', title: 'Reviews', S, context}),
      orderableDocumentListDeskItem({type: 'socialPost', title: 'Social posts', S, context}),
      orderableDocumentListDeskItem({type: 'service', title: 'Services', S, context}),
      S.divider(),
      S.listItem()
        .title('Business info')
        .icon(CogIcon)
        .id('businessInfo')
        .child(S.document().schemaType('businessInfo').documentId('businessInfo')),
      S.listItem()
        .title('Pages')
        .icon(DocumentIcon)
        .child(
          S.list()
            .title('Pages')
            .items(
              PAGE_TYPES.map((page) =>
                S.listItem()
                  .title(page.title)
                  .id(page.name)
                  .icon(DocumentIcon)
                  .child(S.document().schemaType(page.name).documentId(page.name)),
              ),
            ),
        ),
    ])
