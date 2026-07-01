import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F9F7F4',
        taupe: '#D6D0C8',
        'taupe-dark': '#7D756D',
        charcoal: '#2C2C2C',
        'warm-gray': '#4A443C',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
        display: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
