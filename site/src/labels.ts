/**
 * The only interface words on the site.
 *
 * Nothing here is a statement about the business. Every claim, fact, caption,
 * and sentence about Carnegie Hill Gallery & Custom Framing lives in content,
 * with a source. These are the words the interface itself needs: navigation,
 * headings, buttons, aria labels, form labels, and form states.
 *
 * Seeded from the "Written for the concepts" list in `docs/copy-sources.md`
 * and the wording already used in `the-hang/`. This file gets one written
 * sign-off from the client through Juko before launch.
 *
 * Rules for anyone adding a key:
 *   - No em dashes.
 *   - No claim about the shop, its work, its speed, its prices, or its people.
 *   - No arrows or decoration appended to link text.
 */

export const labels = {
  skipToContent: 'Skip to content',

  nav: {
    label: 'Main',
    home: 'Home',
    about: 'About',
    services: 'Services',
    gallery: 'Gallery',
    reviews: 'Reviews',
    contact: 'Contact',
    privacy: 'Privacy notice',
  },

  menu: {
    open: 'Menu',
    close: 'Close',
    label: 'Menu',
  },

  /** Falls back here when a page has no sourced h1. */
  pageHeading: {
    homePage: 'Home',
    aboutPage: 'About',
    servicesPage: 'Services',
    galleryPage: 'Gallery',
    reviewsPage: 'Selected customer reviews',
    contactPage: 'Contact',
    privacyPage: 'Privacy notice',
  },

  sections: {
    fromTheGallery: 'From the gallery',
    whatWeFrame: 'What we frame',
    visitTheShop: 'Visit the shop',
    whatCustomersSay: 'What customers say',
    selectedCustomerReviews: 'Selected customer reviews',
  },

  actions: {
    discussYourProject: 'Discuss your project',
    /** The link from the home page teaser to the About page. */
    aboutTheShop: 'About the shop',
    callTheShop: 'Call the shop',
    getDirections: 'Get directions',
    seeTheGallery: 'See the gallery',
    seeTheFullGallery: 'See the full gallery',
    readAllReviews: 'Read all reviews',
    readOurReviewsOnGoogle: 'Read our reviews on Google',
    leaveAGoogleReview: 'Leave a Google review',
    findUsOnYelp: 'Find us on Yelp',
    viewPost: 'View post',
    loadPost: 'Load post',
  },

  facts: {
    address: 'Address',
    hours: 'Hours',
    phone: 'Phone',
    email: 'Email',
    contactDetails: 'Contact details',
    /** Joins a range: "Monday to Saturday", "10:00 AM to 7:30 PM". */
    to: 'to',
  },

  photoTypes: {
    completedWork: 'Completed work',
    frameOptions: 'Frame options',
    matsGlassDisplay: 'Mats, glass and display',
    theShop: 'The shop',
  },

  platforms: {
    google: 'Google',
    yelp: 'Yelp',
    other: 'Other',
    instagram: 'Instagram',
    facebook: 'Facebook',
    twitter: 'Twitter',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    video: 'Video',
  },

  slider: {
    label: 'Photo row',
    previous: 'Previous',
    next: 'Next',
  },

  lightbox: {
    close: 'Close',
    previous: 'Previous',
    next: 'Next',
    /** Accessible name for the dialog itself. */
    label: 'Photo',
    /** The link a thumbnail falls back to when there is no JavaScript. */
    openFullSize: 'Open full size',
  },

  gallery: {
    /** Accessible name for the row of photo type links. */
    tabs: 'Photo types',
  },

  services: {
    /** Heading over the list of jump links beside the service sections. */
    index: 'On this page',
  },

  redirects: {
    toContact: 'Go to the contact page',
  },

  pagination: {
    label: 'Pages',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
  },

  breadcrumbs: {
    label: 'Breadcrumb',
  },

  footer: {
    pages: 'Pages',
    follow: 'Follow',
  },

  form: {
    legend: 'Contact',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    preferredReply: 'Preferred reply method',
    preferredReplyEmail: 'Email',
    preferredReplyPhone: 'Phone',
    projectDetails: 'Project details',
    projectType: 'Project type',
    dimensions: 'Approximate dimensions',
    timing: 'Desired timing',
    required: 'Required',
    optional: 'Optional',
    submit: 'Send',
    choose: 'Choose one',
    /** Accessible name for the live region that reports the form's state. */
    status: 'Form status',
    /** The honeypot field. Visible only to a machine filling in every input. */
    leaveBlank: 'Leave this field empty',
  },

  formStates: {
    needName: 'Please enter your name.',
    needContact: 'Please enter an email address or a phone number.',
    needDetails: 'Please describe your project.',
    invalidEmail: 'Please check the email address.',
    submitting: 'Sending.',
    sent: 'Your request was sent.',
    failed: 'Your request was not sent. Please call the shop.',
    rateLimited: 'Too many requests. Please try again later, or call the shop.',
  },

  errors: {
    notFoundTitle: 'Page not found',
    notFoundBack: 'Go to the home page',
  },
} as const

export type Labels = typeof labels

/** Flatten to `{ 'nav.home': 'Home', ... }` for the CI visible-string check. */
export function labelEntries(): Record<string, string> {
  const flat: Record<string, string> = {}
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      flat[path] = node
      return
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        walk(value, path === '' ? key : `${path}.${key}`)
      }
    }
  }
  walk(labels, '')
  return flat
}

/** Every label string, deduplicated. The CI string check reads this. */
export function labelList(): string[] {
  return Array.from(new Set(Object.values(labelEntries())))
}

/** Dotted-path lookup, for code that cannot import a nested key directly. */
export function t(path: string): string {
  const value = labelEntries()[path]
  if (value === undefined) throw new Error(`Unknown label key: ${path}`)
  return value
}
