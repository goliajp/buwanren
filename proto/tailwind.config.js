/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f8f6f3',
        'paper-warm': '#f5f2ed',
        ink: '#2c2c2c',
        'ink-light': '#5a5a5a',
        'ink-deep': '#1c1917',
        gold: '#c9a962',
        bronze: '#8b7355',
        jade: '#5a8f7b',
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'Songti SC', 'Georgia', 'serif'],
        sans: ['Noto Sans SC', 'PingFang SC', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'fade-in':   'fadeIn 0.5s ease-out forwards',
        'slide-up':  'slideUp 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
