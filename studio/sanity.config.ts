import {defineConfig, type Template} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes, SINGLETON_TYPES} from './schemas'
import {fullStructure} from './structure/fullStructure'
import {ownerStructure} from './structure/ownerStructure'
import {fullDocumentActions, ownerDocumentActions} from './lib/documentActions'
import {OwnerAddPhotoLayout} from './components/OwnerAddPhotoLayout'
import {isOwnerUser} from './lib/isOwner'
import {dataset, projectId} from './lib/env'

/** One of a kind documents are never created from a menu. */
const withoutSingletons = (templates: Template[]) =>
  templates.filter((template) => !SINGLETON_TYPES.has(template.schemaType))

const onlyPhoto = (templates: Template[]) =>
  templates.filter((template) => template.schemaType === 'photo')

export default defineConfig([
  {
    name: 'default',
    title: 'Carnegie Hill Gallery & Custom Framing',
    basePath: '/',
    projectId,
    dataset,
    plugins: [
      structureTool({
        name: 'content',
        title: 'Content',
        structure: (S, context) =>
          isOwnerUser(context.currentUser) ? ownerStructure(S, context) : fullStructure(S, context),
      }),
      visionTool(),
    ],
    schema: {
      types: schemaTypes,
      templates: withoutSingletons,
    },
    document: {
      actions: fullDocumentActions,
      newDocumentOptions: (prev) =>
        prev.filter((item) => !SINGLETON_TYPES.has(item.templateId)),
    },
  },
  {
    name: 'owner',
    title: 'Photos',
    basePath: '/owner',
    projectId,
    dataset,
    plugins: [
      structureTool({
        name: 'photos',
        title: 'Photos',
        structure: ownerStructure,
      }),
    ],
    schema: {
      types: schemaTypes,
      templates: onlyPhoto,
    },
    document: {
      actions: ownerDocumentActions,
      newDocumentOptions: (prev) => prev.filter((item) => item.templateId === 'photo'),
    },
    studio: {
      components: {layout: OwnerAddPhotoLayout},
    },
  },
])
