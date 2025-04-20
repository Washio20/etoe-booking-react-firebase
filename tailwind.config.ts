import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      fontFamily: {
        "zen-kaku-gothic": ["var(--font-zen-kaku-gothic)"],
      },
      colors: {
        gray: {
          700: "#444444",
          600: "#999999",
          300: "rgba(68, 68, 68, 0.2)",
          200: "#BBBBBB",
          50: "#FAF9F7",
        },
        red: {
          600: "#E51D1D",
        },
      },
      letterSpacing: {
        wider: "0.06em",
      },
    },
  },
  plugins: [],
};
export default config;
