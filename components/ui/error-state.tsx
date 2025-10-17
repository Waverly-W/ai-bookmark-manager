import React from "react"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  error?: string | Error
  action?: React.ReactNode
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ className, title, description, error, action, ...props }, ref) => {
    const errorMessage = error instanceof Error ? error.message : error

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border border-destructive/25 bg-destructive/5 px-6 py-12 text-center",
          className
        )}
        {...props}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          {title || "Something went wrong"}
        </h3>
        {description && (
          <p className="mb-2 text-sm text-muted-foreground">{description}</p>
        )}
        {errorMessage && (
          <p className="mb-4 text-xs text-destructive/80 font-mono">
            {errorMessage}
          </p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    )
  }
)
ErrorState.displayName = "ErrorState"

export { ErrorState }

