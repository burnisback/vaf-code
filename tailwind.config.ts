import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      backgroundImage: {
        'vaf-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
      },
    },
  },
  plugins: [],
}
export default config
