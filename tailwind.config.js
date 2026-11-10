/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        coral: '#F25F45',
        saffron: '#F6B91A',
        ink: '#111111',
        muted: '#A8A29E',
        success: '#16803C',
      },
    },
  },
  plugins: [],
};
