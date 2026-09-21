import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const config = [
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'public/**', '.shots/**', 'next-env.d.ts'] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // next/image cannot run in a static export; Picture is our replacement.
      '@next/next/no-img-element': 'off',
    },
  },
]

export default config
