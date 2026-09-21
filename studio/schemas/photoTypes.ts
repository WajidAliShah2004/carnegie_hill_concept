/**
 * The four photo types. The values must stay identical to the ones site/ uses.
 */
export const PHOTO_TYPES = [
  {value: 'completedWork', title: 'Completed work'},
  {value: 'frameOptions', title: 'Frame options'},
  {value: 'matsGlassDisplay', title: 'Mats, glass and display'},
  {value: 'theShop', title: 'The shop'},
] as const

export type PhotoType = (typeof PHOTO_TYPES)[number]['value']

export const PHOTO_TYPE_TITLES: Record<string, string> = Object.fromEntries(
  PHOTO_TYPES.map((type) => [type.value, type.title]),
)
