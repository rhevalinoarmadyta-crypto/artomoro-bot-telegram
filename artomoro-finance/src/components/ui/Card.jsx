import { cn } from "../../lib/utils"

export function Card({ className, children }) {
  return (
    <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children }) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)}>{children}</div>
}

export function CardTitle({ className, children }) {
  return (
    <h3 className={cn("font-semibold leading-none tracking-tight", className)}>
      {children}
    </h3>
  )
}

export function CardContent({ className, children }) {
  return <div className={cn("p-6 pt-0", className)}>{children}</div>
}
