import type { CollectionConfig } from 'payload'
import { CONTENT_CATEGORIES, DIAGNOSIS_STAGES } from '@halo/shared'
import { isAdmin, isAdminOrEditor } from '../access/isAdmin'
import { syncToContentItems, deleteFromContentItems } from '../hooks/syncToContentItems'
import { preventSlugChangeAfterPublish } from '../hooks/preventSlugChange'

const categoryOptions = CONTENT_CATEGORIES.map((value) => ({
  label: value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' '),
  value,
}))

const stageOptions = DIAGNOSIS_STAGES.map((value) => ({
  label: value.charAt(0).toUpperCase() + value.slice(1),
  value,
}))

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'updatedAt'],
  },
  versions: {
    drafts: true,
    maxPerDoc: 10,
  },
  access: {
    read: ({ req: { user } }) => {
      if (user) return true
      return { _status: { equals: 'published' } }
    },
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [preventSlugChangeAfterPublish],
    afterChange: [syncToContentItems],
    afterDelete: [deleteFromContentItems],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 200,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      maxLength: 200,
      admin: {
        description: 'URL-friendly identifier (lowercase letters, numbers, hyphens only)',
      },
      validate: (value: string | null | undefined) => {
        if (!value) return 'Slug is required'
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'Slug must contain only lowercase letters, numbers, and hyphens'
        }
        return true
      },
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'cms-media',
      admin: {
        description: 'Article thumbnail image (displayed in article cards and hero)',
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: categoryOptions,
    },
    {
      name: 'diagnosisStages',
      type: 'select',
      hasMany: true,
      required: true,
      options: stageOptions,
      admin: {
        description: 'Which diagnosis stages this article applies to',
      },
    },
    {
      name: 'videoUrl',
      type: 'text',
      admin: {
        description: 'Optional video URL (YouTube, Vimeo)',
      },
      validate: (value: string | null | undefined) => {
        if (!value) return true
        try {
          new URL(value)
          return true
        } catch {
          return 'Must be a valid URL'
        }
      },
    },
  ],
}
