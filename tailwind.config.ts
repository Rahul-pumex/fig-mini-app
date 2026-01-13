/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#745263',
        secondary: '#D9BECC',
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        inter: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],      // 12px (was 0.75rem)
        'sm': ['0.8125rem', { lineHeight: '1.25rem' }], // 13px (was 0.875rem)
        'base': ['0.875rem', { lineHeight: '1.5rem' }], // 14px (was 1rem)
        'lg': ['1rem', { lineHeight: '1.75rem' }],      // 16px (was 1.125rem)
        'xl': ['1.125rem', { lineHeight: '1.75rem' }],  // 18px (was 1.25rem)
        '2xl': ['1.25rem', { lineHeight: '2rem' }],     // 20px (was 1.5rem)
        '3xl': ['1.5rem', { lineHeight: '2.25rem' }],   // 24px (was 1.875rem)
        '4xl': ['1.875rem', { lineHeight: '2.5rem' }],  // 30px (was 2.25rem)
        '5xl': ['2.25rem', { lineHeight: '1' }],        // 36px (was 3rem)
      },
    },
  },
  plugins: [],
}

export default config


