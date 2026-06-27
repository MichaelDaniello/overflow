/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // grimy, zine-inspired nautical-horror palette
        ink:    '#0c0d0b',
        ink2:   '#14150f',
        panel:  '#181711',
        edge:   '#3a3528',
        parch:  '#d9cdab',
        parchd: '#b6aa86',
        bone:   '#cabf9f',
        sea:    '#5c8a86',
        sead:   '#3c605d',
        gold:   '#c9a23f',
        rust:   '#9e3527',
        blood:  '#7c1f1f',
        fog:    '#8d8674',
      },
      fontFamily: {
        title: ['"Pirata One"', 'serif'],
        serif: ['"IM Fell English"', 'serif'],
        sans: ['Oswald', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        plate: '6px 6px 0 #000',
      },
    },
  },
  plugins: [],
};
