import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Surface scale ── */
        background:                  'hsl(var(--background))',
        surface:                     'hsl(var(--surface))',
        'surface-dim':               'hsl(var(--surface-dim))',
        'surface-container-lowest':  'hsl(var(--surface-container-lowest))',
        'surface-container-low':     'hsl(var(--surface-container-low))',
        'surface-container':         'hsl(var(--surface-container))',
        'surface-container-high':    'hsl(var(--surface-container-high))',
        'surface-container-highest': 'hsl(var(--surface-container-highest))',
        'surface-bright':            'hsl(var(--surface-bright))',
        'surface-variant':           'hsl(var(--surface-variant))',
        'surface-tint':              'hsl(var(--surface-tint))',

        /* ── On-surface ── */
        'on-background':      'hsl(var(--on-background))',
        'on-surface':         'hsl(var(--on-surface))',
        'on-surface-variant': 'hsl(var(--on-surface-variant))',
        'inverse-surface':    'hsl(var(--inverse-surface))',
        'inverse-on-surface': 'hsl(var(--inverse-on-surface))',

        /* ── Primary ── */
        primary:                    'hsl(var(--primary))',
        'primary-fixed':            'hsl(var(--primary-fixed))',
        'primary-fixed-dim':        'hsl(var(--primary-fixed-dim))',
        'primary-container':        'hsl(var(--primary-container))',
        'on-primary':               'hsl(var(--on-primary))',
        'on-primary-fixed':         'hsl(var(--on-primary-fixed))',
        'on-primary-fixed-variant': 'hsl(var(--on-primary-fixed-variant))',
        'on-primary-container':     'hsl(var(--on-primary-container))',
        'inverse-primary':          'hsl(var(--inverse-primary))',

        /* ── Secondary ── */
        secondary:                    'hsl(var(--secondary))',
        'secondary-fixed':            'hsl(var(--secondary-fixed))',
        'secondary-fixed-dim':        'hsl(var(--secondary-fixed-dim))',
        'secondary-container':        'hsl(var(--secondary-container))',
        'on-secondary':               'hsl(var(--on-secondary))',
        'on-secondary-fixed':         'hsl(var(--on-secondary-fixed))',
        'on-secondary-fixed-variant': 'hsl(var(--on-secondary-fixed-variant))',
        'on-secondary-container':     'hsl(var(--on-secondary-container))',

        /* ── Tertiary ── */
        tertiary:                    'hsl(var(--tertiary))',
        'tertiary-fixed':            'hsl(var(--tertiary-fixed))',
        'tertiary-fixed-dim':        'hsl(var(--tertiary-fixed-dim))',
        'tertiary-container':        'hsl(var(--tertiary-container))',
        'on-tertiary':               'hsl(var(--on-tertiary))',
        'on-tertiary-fixed':         'hsl(var(--on-tertiary-fixed))',
        'on-tertiary-fixed-variant': 'hsl(var(--on-tertiary-fixed-variant))',
        'on-tertiary-container':     'hsl(var(--on-tertiary-container))',

        /* ── Outline ── */
        outline:          'hsl(var(--outline))',
        'outline-variant': 'hsl(var(--outline-variant))',

        /* ── Error ── */
        error:                'hsl(var(--error))',
        'error-container':    'hsl(var(--error-container))',
        'on-error':           'hsl(var(--on-error))',
        'on-error-container': 'hsl(var(--on-error-container))',

        /* ── shadcn/ui compat ── */
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: 'hsl(var(--success))',
        'on-success': 'hsl(var(--on-success))',
        warning: 'hsl(var(--warning))',
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
      },

      fontSize: {
        'label-sm':    ['0.6875rem', { lineHeight: '1rem',    letterSpacing: '0.06em'  }],
        'label-md':    ['0.75rem',   { lineHeight: '1rem',    letterSpacing: '0.03em'  }],
        'label-lg':    ['0.875rem',  { lineHeight: '1.25rem', letterSpacing: '0.01em'  }],
        'body-sm':     ['0.875rem',  { lineHeight: '1.25rem', letterSpacing: '0.025em' }],
        'body-md':     ['1rem',      { lineHeight: '1.5rem'   }],
        'body-lg':     ['1.125rem',  { lineHeight: '1.75rem'  }],
        'title-sm':    ['0.875rem',  { lineHeight: '1.25rem'  }],
        'title-md':    ['1rem',      { lineHeight: '1.5rem'   }],
        'title-lg':    ['1.375rem',  { lineHeight: '1.75rem'  }],
        'headline-sm': ['1.5rem',    { lineHeight: '2rem'     }],
        'headline-md': ['1.75rem',   { lineHeight: '2.25rem'  }],
        'display-sm':  ['2.25rem',   { lineHeight: '2.75rem'  }],
      },

      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },

      borderRadius: {
        lg:   'var(--radius)',
        md:   'calc(var(--radius) - 2px)',
        sm:   'calc(var(--radius) - 4px)',
        '4xl': '2rem',
      },

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
