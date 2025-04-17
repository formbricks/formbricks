"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

const DropdownMenu: React.ComponentType<DropdownMenuPrimitive.DropdownMenuProps> = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger: React.ComponentType<DropdownMenuPrimitive.DropdownMenuTriggerProps> =
  DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup: React.ComponentType<DropdownMenuPrimitive.DropdownMenuGroupProps> =
  DropdownMenuPrimitive.Group;

const DropdownMenuPortal: React.ComponentType<DropdownMenuPrimitive.DropdownMenuPortalProps> =
  DropdownMenuPrimitive.Portal;

const DropdownMenuSub: React.ComponentType<DropdownMenuPrimitive.DropdownMenuSubProps> =
  DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup: React.ComponentType<DropdownMenuPrimitive.DropdownMenuRadioGroupProps> =
  DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger: React.ComponentType<
  DropdownMenuPrimitive.DropdownMenuSubTriggerProps & { inset?: boolean }
> = React.forwardRef<HTMLDivElement, DropdownMenuPrimitive.DropdownMenuSubTriggerProps & { inset?: boolean }>(
  ({ className, inset, children, ...props }, ref) => (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref as any}
      className={cn(
        "flex cursor-default items-center rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 outline-hidden select-none hover:text-slate-700 focus:bg-slate-100 data-[state=open]:bg-slate-100",
        inset && "pl-8",
        className
      )}
      {...props}>
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
);
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent: React.ComponentType<DropdownMenuPrimitive.DropdownMenuSubContentProps> =
  React.forwardRef(({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.SubContent
      ref={ref as any}
      className={cn(
        "animate-in slide-in-from-left-1 z-50 min-w-[8rem] overflow-hidden rounded-lg border border-slate-200 bg-white p-1 font-medium text-slate-600 shadow-xs hover:text-slate-700",
        className
      )}
      {...props}
    />
  ));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

type DropdownMenuContentProps = {
  className?: string;
  sideOffset?: number;
} & Omit<React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>, "ref">;

const DropdownMenuContent: React.ComponentType<DropdownMenuPrimitive.DropdownMenuContentProps> =
  React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
    ({ className, sideOffset = 4, ...props }, ref) => (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn(
            "animate-in data-[side=right]:slide-in-from-left-2 data-[side=left]:slide-in-from-right-2 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-lg border border-slate-200 bg-white p-1 font-medium text-slate-700 shadow-xs",
            className
          )}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    )
  );
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    icon?: React.ReactNode;
  } & React.RefAttributes<React.ElementRef<typeof DropdownMenuPrimitive.Item>>
> = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    icon?: React.ReactNode;
  }
>(({ className, children, inset, icon, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer items-center gap-x-2 rounded-lg px-2 py-1.5 text-sm font-medium outline-hidden select-none focus:bg-slate-100 data-disabled:pointer-events-none data-disabled:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}>
    {icon}
    {children}
  </DropdownMenuPrimitive.Item>
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem: React.ComponentType<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
> = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default items-center rounded-lg py-1.5 pr-2 pl-8 text-sm font-medium outline-hidden select-none focus:bg-slate-100 data-disabled:pointer-events-none data-disabled:opacity-50",
      className
    )}
    checked={checked}
    {...props}>
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem: React.ComponentType<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
> = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default items-center rounded-lg py-1.5 pr-2 pl-8 text-sm font-medium outline-hidden select-none focus:bg-slate-100 data-disabled:pointer-events-none data-disabled:opacity-50",
      className
    )}
    {...props}>
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel: React.ComponentType<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
> = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold text-slate-900", inset && "pl-8", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator: React.ComponentType<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
> = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-slate-100", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

type DropdownMenuShortcutProps = React.HTMLAttributes<HTMLSpanElement> & {
  dangerouslySetInnerHTML?: {
    __html: string;
  };
};

const DropdownMenuShortcut = ({ className, ...props }: DropdownMenuShortcutProps) => {
  return <span className={cn("ml-auto text-xs tracking-widest text-slate-500", className)} {...props} />;
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
