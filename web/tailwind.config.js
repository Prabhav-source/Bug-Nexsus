/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      spacing: {
        '9.5': '2.375rem',
      },
      colors: {
        background: '#080808',
        'background-secondary': '#0D0D0F',
        sidebar: '#0A0A0C',
        surface: '#121214',
        'surface-elevated': '#19191D',
        'surface-hover': '#1F1F26',
        border: '#29292F',
        'border-subtle': '#1E1B1F',
        'border-accent': 'rgba(255, 23, 68, 0.28)',
        primary: {
          DEFAULT: '#FF1744',
          hover: '#FF365D',
          soft: '#FF4D6D',
          dark: '#B00020',
        },
        'secondary-accent': '#D90429',
        text: {
          primary: '#F5F5F7',
          secondary: '#A1A1AA',
          muted: '#71717A',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#FF1744',
        info: '#60A5FA',
        purple: '#A78BFA',
        orange: '#FB923C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(255, 23, 68, 0.35)',
        'glow-sm': '0 0 10px rgba(255, 23, 68, 0.25)',
        'elevated': '0 8px 30px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
        'shimmer': 'shimmer 1.8s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '25%': { transform: 'translateY(-6px) rotate(0.3deg)' },
          '50%': { transform: 'translateY(-4px) rotate(-0.2deg)' },
          '75%': { transform: 'translateY(-7px) rotate(0.1deg)' },
        },
      },
    },
  },
  plugins: [],
};
