import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--button-radius)] border border-transparent font-medium ring-offset-background transition-all duration-200 ease-md-emphasized focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background hover:bg-primary hover:text-primary-foreground",
        subtle:
          "bg-primary-soft text-foreground hover:bg-primary-soft/88",
        tonal:
          "bg-secondary text-secondary-foreground hover:bg-secondary/88",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/92",
        outline:
          "border-border/80 bg-background text-foreground hover:border-primary/40 hover:text-primary",
        secondary:
          "border-border/60 bg-surface-2 text-foreground hover:bg-surface-3",
        ghost:
          "border-transparent bg-transparent text-foreground hover:text-primary",
        link: "border-transparent bg-transparent px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2 text-sm",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
