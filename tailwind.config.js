/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#111111',
          900: '#181818',
          800: '#1D1D1D',
          700: '#242424',
          600: '#2E2E2E',
          500: '#3A3A3A',
        },
        paper: {
          DEFAULT: '#F2F0EB',
          warm: '#E8E3DA',
          deep: '#D8D2C7',
          dim: '#C9C5BD',
          muted: '#929292',
        },
        // `brass` is kept as an alias so existing components inherit the new
        // accent without a risky class rename. It now means cinema red.
        brass: {
          DEFAULT: '#C83B35',
          soft: '#E2625B',
          deep: '#8E2622',
        },
        accent: {
          DEFAULT: '#C83B35',
          soft: '#E2625B',
          deep: '#8E2622',
        },
        ash: '#6F7276',
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        micro: '0.26em',
        wide2: '0.14em',
      },
      fontSize: {
        micro: ['0.625rem', { lineHeight: '1.2' }],
      },
      maxWidth: {
        shell: '1560px',
      },
      transitionTimingFunction: {
        cinema: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.7' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fadeIn 0.5s ease both',
        marquee: 'marquee 48s linear infinite',
        breathe: 'breathe 4.5s ease-in-out infinite',
        scan: 'scan 2.4s linear infinite',
      },
    },
  },
  plugins: [],
}
