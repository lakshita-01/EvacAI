/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        danger:   '#ef4444',
        warning:  '#f59e0b',
        safe:     '#22c55e',
        info:     '#3b82f6',
        critical: '#dc2626',
      },
    },
  },
  plugins: [],
};
