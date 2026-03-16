// This file bridges the Tailwind CSS utility classes with the CSS variables defined in styles.css.
// Instead of hardcoding color values in the HTML, I use CSS variables (like --primary, --background)
// so the design automatically adapts when the theme changes between light and dark mode.
// To change the color palette, only edit public/css/styles.css — not this file.
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                background:  "hsl(var(--background) / <alpha-value>)",
                foreground:  "hsl(var(--foreground) / <alpha-value>)",
                primary: {
                    DEFAULT:    "hsl(var(--primary) / <alpha-value>)",
                    dark:       "hsl(var(--primary-dark) / <alpha-value>)",
                    light:      "hsl(var(--primary-light) / <alpha-value>)",
                    foreground: "hsl(var(--primary-foreground))"
                },
                accent: {
                    DEFAULT:    "hsl(var(--accent) / <alpha-value>)",
                    light:      "hsl(var(--accent-light) / <alpha-value>)",
                    foreground: "hsl(var(--accent-foreground))"
                },
                card:    "hsl(var(--card) / <alpha-value>)",
                border:  "hsl(var(--border) / <alpha-value>)",
                input:   "hsl(var(--input) / <alpha-value>)",
                success: "hsl(var(--success) / <alpha-value>)",
                danger:  "hsl(var(--danger)  / <alpha-value>)",
            },
            borderRadius: {
                xl: "var(--radius)",
            }
        }
    }
}
