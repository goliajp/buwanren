/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 工作台色板 · 中性偏冷,暖金克制 accent
        canvas:    '#fafaf8',
        surface:   '#ffffff',
        'surface-2': '#f4f3f0',
        'surface-3': '#ebe8e0',
        border:    '#e5e3de',
        'border-2': '#c9c6bd',
        ink:       '#18181b',
        'ink-2':   '#3f3f46',
        'ink-3':   '#52525b',
        'ink-4':   '#71717a',
        'ink-5':   '#a1a1aa',
        'ink-6':   '#d4d4d8',
        gold:      '#c9a962',
        'gold-2':  '#8a6f3f',
        'gold-soft': '#f5efde',
        jade:      '#5a8f7b',
        'jade-soft': '#dfeae4',
        vermilion: '#b56750',
        'vermilion-soft': '#f3dcd0',
        slate:     '#5e7588',
      },
      fontFamily: {
        sans: ['Inter', '"PingFang SC"', '"Noto Sans SC"', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
        // serif 保留备用(品牌字)
        serif: ['"Noto Serif SC"', '"Songti SC"', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': '10px',
        '3xs': '9px',
      },
      letterSpacing: {
        ultra: '0.22em',
      },
    },
  },
  plugins: [],
};
