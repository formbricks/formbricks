import { cn } from "@/lib/cn";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & { blur?: boolean }
>(({ className, blur, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      blur && "backdrop-blur-md",
      "bg-opacity-30 fixed inset-0 z-50",
      "data-[state='closed']:animate-fadeOut data-[state='open']:animate-fadeIn"
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps
  extends Pick<
    ModalProps,
    "blur" | "noPadding" | "size" | "hideCloseButton" | "closeOnOutsideClick" | "title" | "restrictOverflow"
  > {}

const sizeClassName = {
  md: "sm:max-w-xl",
  lg: "sm:max-w-[820px]",
  xl: "sm:max-w-[960px] sm:max-h-[640px]",
  xxl: "sm:max-w-[1240px] sm:max-h-[760px]",
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & DialogContentProps
>(
  (
    {
      className,
      children,
      blur,
      noPadding,
      size,
      hideCloseButton,
      restrictOverflow = false,
      closeOnOutsideClick,
      title,
      ...props
    },
    ref
  ) => (
    <DialogPortal>
      <DialogOverlay blur={blur} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%] transform rounded-lg bg-white text-left shadow-xl transition-all sm:my-2 sm:w-full sm:max-w-xl",
          `${noPadding ? "" : "px-4 pt-5 pb-4 sm:p-6"}`,
          "data-[state='closed']:animate-fadeOut data-[state='open']:animate-fadeIn",
          size && sizeClassName && sizeClassName[size],
          !restrictOverflow && "overflow-hidden",
          className
        )}
        {...props}
        onPointerDownOutside={(e) => {
          if (!closeOnOutsideClick) {
            e.preventDefault();
          }
        }}>
        <DialogPrimitive.DialogTitle>
          {title && <p className="mb-4 text-xl font-bold text-slate-500">{title}</p>}
        </DialogPrimitive.DialogTitle>
        <DialogPrimitive.DialogDescription></DialogPrimitive.DialogDescription>
        {children}
        <DialogPrimitive.Close
          className={cn(
            "absolute top-0 right-0 hidden pt-4 pr-4 text-slate-400 hover:text-slate-500 focus:ring-0 focus:outline-none sm:block",
            hideCloseButton && "!hidden"
          )}>
          <XIcon className="h-6 w-6 rounded-md bg-white" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

interface ModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  children: React.ReactNode;
  title?: string;
  noPadding?: boolean;
  blur?: boolean;
  closeOnOutsideClick?: boolean;
  className?: string;
  size?: "md" | "lg" | "xl" | "xxl";
  hideCloseButton?: boolean;
  restrictOverflow?: boolean;
}

export const Modal = ({
  open,
  setOpen,
  children,
  blur = true,
  size = "md",
  noPadding,
  hideCloseButton = false,
  closeOnOutsideClick = true,
  title,
  className,
  restrictOverflow = false,
}: ModalProps) => {
  if (!open) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(open: boolean) => setOpen(open)} modal>
      <DialogContent
        blur={blur}
        size={size}
        noPadding={noPadding}
        hideCloseButton={hideCloseButton}
        closeOnOutsideClick={closeOnOutsideClick}
        title={title}
        className={className}
        restrictOverflow={restrictOverflow}>
        {children}
      </DialogContent>
    </DialogPrimitive.Root>
  );
};
