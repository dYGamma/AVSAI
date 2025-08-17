// /anime-app/frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-purple': '#8B5CF6',
        'dark-bg': '#111827',
        'dark-card': '#1F2937',
        'dark-nav': '#374151',
      }
    },
  },
  plugins: [],
}
