/** @type {import('tailwindcss').Config} */
// The Instrument house style (instrument-design skill) as a Tailwind theme.
// The palette is named by job, not by hue, so a class says what a colour
// means: `text-arc` is live, `text-gold` needs attention. The values live as
// CSS variables in index.css, where the offline token swap can reach them.
//
// Radius and shadow are overridden, not extended, so no class can bring back
// a rounded or shadowed box: every rounded-* is at most 2px, every shadow-*
// is none. A circle is drawn deliberately, with `rounded-circle`.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                ground: token('ground'),
                panel: token('panel'),
                'panel-lit': token('panel-lit'),
                engrave: token('engrave'),
                ink: token('ink'),
                'ink-dim': token('ink-dim'),
                arc: token('arc'),
                'arc-dim': token('arc-dim'),
                gold: token('gold'),
                alert: token('alert'),
                slate: token('slate'),
                'slate-dim': token('slate-dim'),
                go: token('go'),
                // Chart fills: the accents one step deeper (a block of full arc glares).
                'c-1': token('c-1'),
                'c-2': token('c-2'),
                'c-3': token('c-3'),
            },
            fontFamily: {
                data: ['Archivo', 'system-ui', 'sans-serif'],
                mono: ['"Plex Mono"', 'ui-monospace', '"Roboto Mono"', 'monospace'],
            },
            fontSize: {
                min: ['0.75rem', { lineHeight: '1.35' }],     // the floor
                label: ['0.8125rem', { lineHeight: '1.35' }],
            },
            letterSpacing: {
                label: '0.16em',
                stamp: '0.08em',
                mark: '0.3em',
            },
            // A plain `border` is a 2px rule: hairlines smear or vanish.
            borderWidth: {
                DEFAULT: '2px',
                rule: '2px',
            },
        },
        borderRadius: {
            none: '0',
            sm: '2px',
            DEFAULT: '2px',
            md: '2px',
            lg: '2px',
            xl: '2px',
            '2xl': '2px',
            '3xl': '2px',
            full: '2px',
            circle: '9999px',
        },
        boxShadow: {
            sm: 'none',
            DEFAULT: 'none',
            md: 'none',
            lg: 'none',
            xl: 'none',
            '2xl': 'none',
            inner: 'none',
            none: 'none',
        },
    },
    plugins: [],
}
