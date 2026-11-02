import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: { colors: { ink: "#172033", muted: "#778198", brand: "#635BFF" } } },
  plugins: []
};
export default config;
