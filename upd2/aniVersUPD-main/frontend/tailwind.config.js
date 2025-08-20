/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: false,
  theme: {
    extend: {
      colors: {
        // Монохромная палитра
        'dark-bg': '#0b0f12',
        'surface-900': '#0f1418',
        'dark-card': '#111418',
        'muted': '#9aa3ad',
        'muted-2': '#6b7280',
        'muted-3': '#4b5563',
        'accent': '#cbd5dd',
        'accent-2': '#e6eef3',
        'glass': 'rgba(255,255,255,0.02)',
        'soft-border': 'rgba(255,255,255,0.035)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial'],
      },
      boxShadow: {
        'card-sm': '0 6px 18px rgba(2,6,23,0.6)',
        'card-md': '0 12px 30px rgba(2,6,23,0.7)',
        'glow': '0 6px 30px rgba(0,0,0,0.15)'
      },
      keyframes: {
        float: {
          '0%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
          '100%': { transform: 'translateY(0px)' }
        },
        fadeInUp: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        },
        pulseAccent: {
          '0%': { boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
          '70%': { boxShadow: '0 0 0 12px rgba(0,0,0,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(0,0,0,0)' }
        }
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        fadeInUp: 'fadeInUp 420ms cubic-bezier(.2,.9,.3,1) both',
        'pulse-accent': 'pulseAccent 1.8s infinite'
      },
      borderRadius: {
        'xl-2': '14px',
      }
    },
  },
  plugins: [],
}
