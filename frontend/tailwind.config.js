/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        warm: {
          50: '#FAF9F6',
          100: '#F5F4F0',
          200: '#EBE9E2',
          300: '#DDD9CF',
          400: '#BCB6A6',
          500: '#948D7C',
          600: '#6E685A',
          700: '#4A463B',
          800: '#2C2A24',
          900: '#1C1B17',
          950: '#11100D',
        },
        linear: {
          surface: '#FAF9F6',
          panel: '#FFFFFF',
          sidebar: '#F5F4F0',
          border: '#E8E5DF',
          hover: '#EFECE6',
          text: '#191919',
          muted: '#737373',
          darkBg: '#0F1012',
          darkSurface: '#16171B',
          darkPanel: '#1C1D22',
          darkSidebar: '#131417',
          darkBorder: '#272930',
          darkHover: '#22242B',
          darkText: '#EDEDED',
          darkMuted: '#909296',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'elevated': '0 4px 16px -2px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'overlay': '0 12px 32px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}
