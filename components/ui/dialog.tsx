// ─── components/ui/dialog.tsx ────────────────────────────────────────────────
//
// Shadcn-compatible Dialog built on @base-ui/react/dialog.
//
// Real exports confirmed from node_modules/@base-ui/react/esm/dialog/index.parts.js:
//   Root, Trigger, Portal, Backdrop, Popup, Close, Title, Description, Viewport,
//   Handle, createHandle
//
// We use: Root · Trigger · Portal · Popup · Close · Title · Description
// We skip: Backdrop (replaced by a plain <div> overlay), Viewport, Handle

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Root ─────────────────────────────────────────────────────────────────────

const Dialog = DialogPrimitive.Root

// ─── Trigger ──────────────────────────────────────────────────────────────────

const DialogTrigger = DialogPrimitive.Trigger

// ─── Close ────────────────────────────────────────────────────────────────────

const DialogClose = DialogPrimitive.Close

// ─── Portal ───────────────────────────────────────────────────────────────────

const DialogPortal = DialogPrimitive.Portal

// ─── Overlay — plain <div>, no DialogPrimitive.Backdrop ──────────────────────

function DialogOverlay({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  )
}

// ─── Content ──────────────────────────────────────────────────────────────────
//
// Wraps Portal + Overlay + Popup in one component, and adds a close button.

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg",
          "-translate-x-1/2 -translate-y-1/2",
          "max-h-[90dvh] overflow-y-auto",
          "rounded-xl border border-border bg-card p-6 shadow-xl",
          "focus:outline-none",
          "transition-all duration-150",
          "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          "data-[ending-style]:scale-95   data-[ending-style]:opacity-0",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Fermer"
          className={cn(
            "absolute right-4 top-4 rounded-md p-1",
            "text-muted-foreground opacity-70 transition-opacity",
            "hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none",
          )}
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

// ─── Title — uses DialogPrimitive.Title ───────────────────────────────────────

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold text-foreground", className)}
      {...props}
    />
  )
}

// ─── Description — uses DialogPrimitive.Description ───────────────────────────

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
