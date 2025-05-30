"use client";

import { cn } from "@/lib/cn";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = ({ children, ...props }: DialogPrimitive.DialogPortalProps) => (
  <DialogPrimitive.Portal {...props}>
    <div className="fixed inset-0 z-50 flex items-start justify-center md:items-center">{children}</div>
  </DialogPrimitive.Portal>
);
DialogPortal.displayName = DialogPrimitive.Portal.displayName;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-all duration-100",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps {
  hideCloseButton?: boolean;
  disableCloseOnOutsideClick?: boolean;
  width?: "default" | "wide";
}

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & DialogContentProps
>(
  (
    { className, children, hideCloseButton, disableCloseOnOutsideClick, width = "default", ...props },
    ref
  ) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "animate-in data-[state=open]:fade-in-90 data-[state=open]:slide-in-from-bottom-10 md:zoom-in-90 data-[state=open]:md:slide-in-from-bottom-0 fixed z-50 flex w-full flex-col space-y-4 overflow-hidden rounded-b-lg border bg-white p-4 shadow-lg md:max-h-[90dvh] md:rounded-lg",
          width === "default" ? "md:w-[720px]" : "md:w-[720px] lg:w-[960px]",
          className
        )}
        onPointerDownOutside={disableCloseOnOutsideClick ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={disableCloseOnOutsideClick ? (e) => e.preventDefault() : undefined}
        {...props}>
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute right-3 top-[-0.25rem] z-10 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

type DialogHeaderProps = Omit<React.HTMLAttributes<HTMLDivElement>, "dangerouslySetInnerHTML"> & {
  dangerouslySetInnerHTML?: {
    __html: string;
  };
};

const DialogHeader = ({ className, ...props }: DialogHeaderProps) => (
  <div
    className={cn(
      "sticky top-[-32px] z-10 flex flex-shrink-0 flex-col gap-y-1 bg-white text-center md:text-left",
      "[&>svg]:text-primary [&>svg]:absolute [&>svg]:size-4 md:[&>svg~*]:flex md:[&>svg~*]:items-center md:[&>svg~*]:pl-6",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

type DialogFooterProps = Omit<React.HTMLAttributes<HTMLDivElement>, "dangerouslySetInnerHTML"> & {
  dangerouslySetInnerHTML?: {
    __html: string;
  };
};

const DialogFooter = ({ className, ...props }: DialogFooterProps) => (
  <div
    className={cn(
      "sticky bottom-0 z-10 flex flex-shrink-0 flex-col-reverse bg-white md:flex-row md:justify-end md:space-x-2",
      className
    )}
    {...props}
  />
);

DialogFooter.displayName = "DialogFooter";

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-4 flex-1 overflow-y-auto", className)} {...props} />
);
DialogBody.displayName = "DialogBody";

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-primary text-sm font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("font-regular text-sm text-slate-500", className)} //muted does not work here for some reason
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
};
