import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: 'hsl(214 100% 97%)',
          100: 'hsl(214 95% 93%)',
          200: 'hsl(213 97% 87%)',
          300: 'hsl(212 96% 78%)',
          400: 'hsl(213 94% 68%)',
          500: 'hsl(217 91% 60%)',
          600: 'hsl(221 83% 53%)',
          700: 'hsl(224 76% 48%)',
          800: 'hsl(226 71% 40%)',
          900: 'hsl(224 64% 33%)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          50: 'hsl(138 76% 97%)',
          100: 'hsl(141 84% 93%)',
          500: 'hsl(142 71% 45%)',
          600: 'hsl(142 76% 36%)',
        },
        warning: {
          50: 'hsl(48 100% 96%)',
          100: 'hsl(48 96% 89%)',
          500: 'hsl(38 92% 50%)',
          600: 'hsl(32 95% 44%)',
        },
        danger: {
          50: 'hsl(0 86% 97%)',
          100: 'hsl(0 93% 94%)',
          500: 'hsl(0 72% 51%)',
          600: 'hsl(0 74% 42%)',
        },
        purple: {
          50: 'hsl(270 100% 98%)',
          100: 'hsl(269 100% 95%)',
          200: 'hsl(269 100% 92%)',
          300: 'hsl(269 97% 85%)',
          400: 'hsl(270 95% 75%)',
          500: 'hsl(271 91% 65%)',
          600: 'hsl(262 83% 58%)',
          700: 'hsl(263 70% 50%)',
          800: 'hsl(263 69% 42%)',
          900: 'hsl(264 67% 35%)',
        },
        indigo: {
          50: 'hsl(226 100% 97%)',
          100: 'hsl(226 100% 94%)',
          500: 'hsl(239 84% 67%)',
          600: 'hsl(243 75% 59%)',
          700: 'hsl(245 58% 51%)',
        },
        neutral: {
          50: 'hsl(210 40% 98%)',
          100: 'hsl(210 40% 96%)',
          200: 'hsl(214 32% 91%)',
          300: 'hsl(213 27% 84%)',
          400: 'hsl(215 20% 65%)',
          500: 'hsl(215 16% 47%)',
          600: 'hsl(215 19% 35%)',
          700: 'hsl(215 25% 27%)',
          800: 'hsl(217 33% 17%)',
          900: 'hsl(222 47% 11%)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        display: ['DM Sans', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'Menlo', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        shimmer: 'shimmer 2s linear infinite',
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
