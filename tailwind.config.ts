import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-cairo)", "Cairo", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "var(--md-sys-color-primary)",
          container: "var(--md-sys-color-primary-container)",
        },
        "on-primary": {
          DEFAULT: "var(--md-sys-color-on-primary)",
          container: "var(--md-sys-color-on-primary-container)",
        },
        secondary: {
          DEFAULT: "var(--md-sys-color-secondary)",
          container: "var(--md-sys-color-secondary-container)",
        },
        "on-secondary": {
          DEFAULT: "var(--md-sys-color-on-secondary)",
          container: "var(--md-sys-color-on-secondary-container)",
        },
        tertiary: {
          DEFAULT: "var(--md-sys-color-tertiary)",
          container: "var(--md-sys-color-tertiary-container)",
        },
        "on-tertiary": {
          DEFAULT: "var(--md-sys-color-on-tertiary)",
          container: "var(--md-sys-color-on-tertiary-container)",
        },
        surface: {
          DEFAULT: "var(--md-sys-color-surface)",
          variant: "var(--md-sys-color-surface-variant)",
          tint: "var(--md-sys-color-surface-tint)",
        },
        "on-surface": {
          DEFAULT: "var(--md-sys-color-on-surface)",
          variant: "var(--md-sys-color-on-surface-variant)",
        },
        background: "var(--md-sys-color-background)",
        "on-background": "var(--md-sys-color-on-background)",
        outline: {
          DEFAULT: "var(--md-sys-color-outline)",
          variant: "var(--md-sys-color-outline-variant)",
        },
        error: {
          DEFAULT: "var(--md-sys-color-error)",
          container: "var(--md-sys-color-error-container)",
        },
        "on-error": {
          DEFAULT: "var(--md-sys-color-on-error)",
          container: "var(--md-sys-color-on-error-container)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
