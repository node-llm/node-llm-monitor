/** @type {import('tailwindcss').Config} */
export default {
  // The dashboard sets "dark" itself, from the host's theme option or the system setting.
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        monitor: {
          bg: "#f8f9fa",
          card: "#ffffff",
          border: "#e5e7eb",
          accent: "rgb(var(--monitor-accent-rgb, 99 102 241) / <alpha-value>)",
          "accent-light": "rgb(var(--monitor-accent-light-rgb, 129 140 248) / <alpha-value>)",
          success: "#22c55e",
          error: "#ef4444",
          warning: "#f59e0b"
        }
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
};
