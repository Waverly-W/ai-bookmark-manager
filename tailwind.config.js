/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
    darkMode: ["class"],
    content: [
        './entrypoints/**/*.{html,ts,tsx}',
        './components/**/*.{html,ts,tsx}'
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            fontFamily: {
                sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
                display: ["var(--font-display)", ...defaultTheme.fontFamily.sans],
                mono: ["var(--font-mono)", ...defaultTheme.fontFamily.mono],
            },
            transitionTimingFunction: {
                'md-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
                'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.15)',
            },
            transitionDuration: {
                '1500': '1500ms',
                '2000': '2000ms',
            },
            fontSize: {
                xs: ['12px', { lineHeight: '1.4' }],
                sm: ['14px', { lineHeight: '1.45' }],
                base: '16px',
                lg: ['18px', { lineHeight: '1.5' }],
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                    soft: "hsl(var(--primary-soft))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                surface: {
                    1: "hsl(var(--surface-1))",
                    2: "hsl(var(--surface-2))",
                    3: "hsl(var(--surface-3))",
                    inverse: "hsl(var(--surface-inverse))",
                    overlay: "hsl(var(--surface-overlay))",
                },
                text: {
                    1: "hsl(var(--text-1))",
                    2: "hsl(var(--text-2))",
                    3: "hsl(var(--text-3))",
                },
                "surface-container": "hsl(var(--surface-container))",
                "surface-container-high": "hsl(var(--surface-container-high))",
                "secondary-container": "hsl(var(--secondary-container))",
                "on-secondary-container": "hsl(var(--on-secondary-container))",
                "on-surface": "hsl(var(--on-surface))",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "var(--radius-md)",
                sm: "var(--radius-sm)",
            },
            boxShadow: {
                sm: "var(--shadow-sm)",
                md: "var(--shadow-md)",
                panel: "var(--shadow-panel)",
                focus: "var(--shadow-focus)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}
