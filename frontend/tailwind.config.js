/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#07070d',
        panel: '#0d0d17',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.5' },
          '100%': { transform: 'scale(1.75)', opacity: '0' },
        },
        scan: {
          '0%': { top: '-4%', opacity: '0' },
          '12%': { opacity: '1' },
          '88%': { opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-delayed': 'float 7s ease-in-out 1.5s infinite',
        'pulse-ring': 'pulse-ring 2.8s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'pulse-ring-delayed': 'pulse-ring 2.8s cubic-bezier(0.22, 1, 0.36, 1) 1.4s infinite',
        scan: 'scan 2.6s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        'spin-slower': 'spin-slow 14s linear infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
      },
    },
  },
  plugins: [],
};
