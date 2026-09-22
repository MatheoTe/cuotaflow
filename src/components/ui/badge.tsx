import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-label-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-primary text-on-primary',
        secondary:   'border-transparent bg-surface-container-high text-on-surface',
        destructive: 'border-transparent bg-error/20 text-error',
        outline:     'border-outline-variant text-on-surface-variant',
        success:     'border-transparent bg-primary/15 text-primary',
        warning:     'border-transparent bg-warning/15 text-warning',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
