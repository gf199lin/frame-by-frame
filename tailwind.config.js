/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#29251F',
          900: '#211E19',
          800: '#332E27',
          700: '#3D372F',
          600: '#4A4238',
          500: '#5A5045',
        },
        paper: {
          DEFAULT: '#E9E0D0',
          warm: '#E3D9C8',
          deep: '#D8CCB8',
          dim: '#C7BBA8',
          muted: 'var(--paper-muted, #6B5F4E)',
        },
        // `brass` keeps its class name for continuity, but it now carries the
        // dark-brown accent. No red exists anywhere in the palette.
        brass: {
          DEFAULT: '#29251F',
          soft: '#4A4236',
          deep: '#181510',
        },
        accent: {
          DEFAULT: '#29251F',
          soft: '#4A4236',
          deep: '#181510',
        },
        archive: '#C7BBA8',
        taupe: '#6B5F4E',
        ash: '#6B5F4E',
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
