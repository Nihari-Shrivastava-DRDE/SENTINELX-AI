/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#050816',
          secondary: '#0B1120',
        },
        primary: {
          DEFAULT: '#00E5FF',
          dark: '#00BFFF',
        },
        secondary: '#00FF9D',
        accent: '#00BFFF',
        danger: '#FF4D4D',
        success: '#00FF88',
      },
      animation: {
        'scan': 'scan 2s linear infinite',
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}
