/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: { 200: '#f8e7b0', 400: '#e6c15a' },
        crimson: '#b4232c',
        ink: '#1c120c',
      },
      fontFamily: { display: ['"Song Myung"', 'Batang', 'serif'] },
    },
  },
  plugins: [],
}
