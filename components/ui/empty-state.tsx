import React from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string | React.ReactNode
  features?: string[] | React.ReactNode
  actions?: React.ReactNode
  variant?: 'default' | 'search'
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, features, actions, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50 px-6 py-12 text-center",
        variant === 'search' && "py-8",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-4xl">
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-xl font-semibold text-foreground">{title}</h3>

      {description && (
        typeof description === 'string' ? (
          <p className="mb-4 text-sm text-muted-foreground max-w-md">{description}</p>
        ) : (
          <div className="mb-4 text-sm text-muted-foreground max-w-md">{description}</div>
        )
      )}

      {features && (
        <div className="mt-4 mb-6 text-left max-w-md w-full">
          {Array.isArray(features) ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          ) : (
            features
          )}
        </div>
      )}

      {actions && <div className="mt-4 flex flex-wrap gap-3 justify-center">{actions}</div>}
    </div>
  )
)
EmptyState.displayName = "EmptyState"

export { EmptyState }

