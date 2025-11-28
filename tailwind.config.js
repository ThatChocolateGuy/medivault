/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      keyframes: {
        'scan-line': {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fadeIn': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slideIn': {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'scan-line': 'scan-line 2s ease-in-out infinite',
        'fadeIn': 'fadeIn 0.2s ease-out',
        'slideIn': 'slideIn 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
