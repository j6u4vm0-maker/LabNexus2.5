import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
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
        body: ['Inter', 'sans-serif'],
        headline: ['Inter', 'sans-serif'],
        code: ['monospace'],
      },
      colors: {
        kst: {
          navy: '#002157',
          deepsky: '#00153D',
          lime: '#E1F32C',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        status: {
          experimental: 'hsl(var(--status-experimental))',
          'experimental-foreground': 'hsl(var(--status-experimental-foreground))',
          review: 'hsl(var(--status-review))',
          'review-foreground': 'hsl(var(--status-review-foreground))',
          cancelled: 'hsl(var(--status-cancelled))',
          'cancelled-foreground': 'hsl(var(--status-cancelled-foreground))',
          completed: 'hsl(var(--status-completed))',
          'completed-foreground': 'hsl(var(--status-completed-foreground))',
          assigned: 'hsl(var(--status-assigned))',
          'assigned-foreground': 'hsl(var(--status-assigned-foreground))',
          closed: 'hsl(var(--status-closed))',
          'closed-foreground': 'hsl(var(--status-closed-foreground))',
          pending: 'hsl(var(--status-pending))',
          'pending-foreground': 'hsl(var(--status-pending-foreground))',
          reserved: 'hsl(var(--status-reserved))',
          'reserved-foreground': 'hsl(var(--status-reserved-foreground))',
          testing: 'hsl(var(--status-testing))',
          'testing-foreground': 'hsl(var(--status-testing-foreground))',
          verifying: 'hsl(var(--status-verifying))',
          'verifying-foreground': 'hsl(var(--status-verifying-foreground))',
          maintenance: 'hsl(var(--status-maintenance))',
          'maintenance-foreground': 'hsl(var(--status-maintenance-foreground))',
          inprogress: 'hsl(var(--status-inprogress))',
          'inprogress-foreground': 'hsl(var(--status-inprogress-foreground))',
          delayed: 'hsl(var(--status-delayed))',
          'delayed-foreground': 'hsl(var(--status-delayed-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

    