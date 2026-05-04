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
        cream: '#FAF9F7',
        taupe: '#D6D0C8',
        'taupe-dark': '#B8B0A6',
        charcoal: '#2C2C2C',
        'warm-gray': '#8A8578',
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
