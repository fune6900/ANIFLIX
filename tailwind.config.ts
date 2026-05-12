import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        "3xl": "1920px",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": {
            opacity: "0",
            transform: "translateX(48px) scale(0.98)",
            filter: "blur(4px)",
          },
          "60%": { filter: "blur(0)" },
          "100%": {
            opacity: "1",
            transform: "translateX(0) scale(1)",
            filter: "blur(0)",
          },
        },
        "slide-in-left": {
          "0%": {
            opacity: "0",
            transform: "translateX(-48px) scale(0.98)",
            filter: "blur(4px)",
          },
          "60%": { filter: "blur(0)" },
          "100%": {
            opacity: "1",
            transform: "translateX(0) scale(1)",
            filter: "blur(0)",
          },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "60%": { opacity: "1", transform: "scale(1.02)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "card-in": {
          "0%": { opacity: "0", transform: "translateY(24px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
        "slide-in-right":
          "slide-in-right 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-left":
          "slide-in-left 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pop-in": "pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "card-in": "card-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
