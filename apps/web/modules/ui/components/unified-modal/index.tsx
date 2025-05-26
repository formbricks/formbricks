"use client";

import { cn } from "@/lib/cn";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

const MyDialog = DialogPrimitive.Root;

const MyDialogTrigger = DialogPrimitive.Trigger;

const MyDialogPortal = ({ children, ...props }: DialogPrimitive.DialogPortalProps) => (
  <DialogPrimitive.Portal {...props}>
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">{children}</div>
  </DialogPrimitive.Portal>
);
MyDialogPortal.displayName = DialogPrimitive.Portal.displayName;

const MyDialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "bg-background/80 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in fixed inset-0 z-50 backdrop-blur-sm transition-all duration-100",
      className
    )}
    {...props}
  />
));
MyDialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const MyDialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideCloseButton?: boolean;
  }
>(({ className, children, hideCloseButton, ...props }, ref) => (
  <MyDialogPortal>
    <MyDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "bg-background animate-in data-[state=open]:fade-in-90 data-[state=open]:slide-in-from-bottom-10 sm:zoom-in-90 data-[state=open]:sm:slide-in-from-bottom-0 fixed z-50 grid w-full gap-4 rounded-b-lg border p-4 shadow-lg sm:w-[720px] sm:rounded-lg",
        className
      )}
      {...props}>
      {children}
      <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute right-3 top-3 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none">
        {!hideCloseButton ? <X className="size-4" /> : null}
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </MyDialogPortal>
));
MyDialogContent.displayName = DialogPrimitive.Content.displayName;

type MyDialogHeaderProps = Omit<React.HTMLAttributes<HTMLDivElement>, "dangerouslySetInnerHTML"> & {
  dangerouslySetInnerHTML?: {
    icon?: React.ReactNode;
    __html: string;
  };
};

const MyDialogHeader = ({ className, ...props }: MyDialogHeaderProps) => (
  <div
    className={cn(
      "flex flex-col gap-y-1.5 text-center sm:text-left [&>svg]:size-6 sm:[&>svg]:absolute sm:[&>svg]:left-4 sm:[&>svg]:top-5 sm:[&>svg~*]:pl-8",
      className
    )}
    {...props}
  />
);
MyDialogHeader.displayName = "DialogHeader";

type MyDialogFooterProps = Omit<React.HTMLAttributes<HTMLDivElement>, "dangerouslySetInnerHTML"> & {
  dangerouslySetInnerHTML?: {
    __html: string;
  };
};

const MyDialogFooter = ({ className, ...props }: MyDialogFooterProps) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-1.5", className)}
    {...props}
  />
);

MyDialogFooter.displayName = "DialogFooter";

const MyDialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-sm font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
MyDialogTitle.displayName = DialogPrimitive.Title.displayName;

const MyDialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-muted-foreground font-regular text-sm", className)} //muted does not work here for some reason
    {...props}
  />
));
MyDialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  MyDialog,
  MyDialogContent,
  MyDialogDescription,
  MyDialogFooter,
  MyDialogHeader,
  MyDialogTitle,
  MyDialogTrigger,
};
