/** @type {import('tailwindcss').Config} */
export default {
content: [
  './index.html',
  './src/**/*.{js,jsx,ts,tsx}',
],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#E6F1FB',
          100: '#B5D4F4',
          200: '#85B7EB',
          400: '#378ADD',
          600: '#185FA5',
          800: '#0C447C',
          900: '#042C53',
        },
      },
    },
  },
  plugins: [],
}
