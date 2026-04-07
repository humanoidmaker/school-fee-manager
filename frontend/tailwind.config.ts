import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: { colors: { primary: { DEFAULT: '#1e3a5f' }, accent: { DEFAULT: '#f59e0b' } }, fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] } } },
  plugins: [],
} satisfies Config;
