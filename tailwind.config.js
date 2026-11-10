/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#161C66',
          900: '#10154A',
          800: '#141A5E',
          700: '#1D2379',
          600: '#2A3189',
          500: '#3C4497',
        },
        paper: {
          DEFAULT: '#F4EAD2',
          warm: '#EFE3C8',
          deep: '#E6D8B9',
          dim: '#CBC8D9',
          sheet: '#FDF6E2',
          soft: '#FAF1DC',
          muted: 'var(--paper-muted, #5A5F85)',
        },
        // `brass` keeps its historical class name; it now carries the ocean
        // blue accent shared with the personal homepage.
        brass: {
          DEFAULT: '#2A3189',
          soft: '#3C4497',
          deep: '#1D2379',
        },
        accent: {
          DEFAULT: '#2A3189',
          soft: '#3C4497',
          deep: '#1D2379',
        },
        ocean: {
          DEFAULT: '#1D2379',
          deep: '#121750',
          soft: '#2A3189',
        },
        sand: '#B98B63',
        archive: '#E6D8B9',
        taupe: '#4A5078',
        ash: '#666C92',
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Georgia', 'serif'],
        poster: ['"Bodoni Moda"', '"Instrument Serif"', '"Noto Serif SC"', 'Georgia', 'serif'],
        serif: ['"Noto Serif SC"', '"Songti SC"', 'STSong', 'SimSun', 'Georgia', 'serif'],
        sans: ['Inter', '"Noto Sans SC"', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        micro: '0.2em',
        wide2: '0.12em',
      },
      fontSize: {
        micro: ['0.625rem', { lineHeight: '1.2' }],
      },
      maxWidth: {
        shell: '1560px',
      },
      borderRadius: {
        card: '12px',
        sheet: '18px',
      },
      boxShadow: {
        card: '0 18px 44px rgba(29, 35, 121, 0.10)',
        lift: '0 26px 60px rgba(29, 35, 121, 0.14)',
        print: '10px 12px 0 rgba(29, 35, 121, 0.06), 0 20px 44px rgba(29, 35, 121, 0.10)',
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
