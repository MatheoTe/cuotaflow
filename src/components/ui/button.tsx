import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-body-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-primary text-on-primary hover:opacity-90',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
        outline:     'border border-outline-variant bg-transparent text-on-surface-variant hover:text-on-surface hover:border-primary',
        secondary:   'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
        ghost:       'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
        link:        'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm:      'h-8 px-4 text-label-md',
        lg:      'h-12 px-6',
        icon:    'h-9 w-9 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
