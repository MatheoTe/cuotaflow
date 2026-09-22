import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface ring-offset-background',
        'placeholder:text-on-surface-variant',
        'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export { Input }
