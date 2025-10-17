import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-smooth outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted/30 disabled:border-muted md:text-sm",
  {
    variants: {
      variant: {
        default:
          "border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        destructive:
          "border-destructive/50 file:text-foreground placeholder:text-muted-foreground selection:bg-destructive selection:text-destructive-foreground dark:bg-destructive/10 focus-visible:border-destructive focus-visible:ring-destructive/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
      },
      size: {
        sm: "h-8 px-2 py-0.5 text-sm",
        default: "h-9 px-3 py-1 text-base",
        lg: "h-10 px-4 py-2 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, type, ...props }, ref) => (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input, inputVariants }
