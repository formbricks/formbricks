"use client";

import { cn } from "@/lib/cn";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

const tabsVariants = cva(
  "bg-slate-100 rounded-lg p-1 inline-flex items-center overflow-x-auto [scrollbar-width:none]",
  {
    variants: {
      variant: {
        default: "",
        disabled: "opacity-50 pointer-events-none",
      },
      size: {
        default: "h-9",
        big: "h-auto",
      },
      width: {
        fill: "w-full",
        fit: "w-fit max-w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      width: "fit",
    },
  }
);

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600",
        disabled: "opacity-50 pointer-events-none",
      },
      size: {
        default: "px-3 py-1 [&_svg]:size-4 [&_svg]:stroke-2",
        big: "px-3 py-2 [&_svg]:size-8 [&_svg]:stroke-[1.5]",
      },
      layout: {
        row: "flex-row gap-2",
        column: "flex-col gap-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      layout: "row",
    },
  }
);

interface TabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {}

function Tabs({ className, ...props }: TabsProps) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-2", className)} {...props} />;
}

interface TabsListProps
  extends React.ComponentProps<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsVariants> {}

interface TabsTriggerProps
  extends React.ComponentProps<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {
  readonly icon?: React.ReactNode;
  readonly showIcon?: boolean;
}

function TabsList({ className, variant, size, width, ...props }: TabsListProps) {
  const isGridLayout = width === "fill";

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        tabsVariants({ variant, size, width }),
        isGridLayout ? "grid grid-cols-[repeat(var(--tabs-count),1fr)]" : "flex",
        className
      )}
      style={
        isGridLayout
          ? ({ "--tabs-count": React.Children.count(props.children) } as React.CSSProperties)
          : undefined
      }
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  variant,
  size,
  layout,
  icon,
  showIcon = true,
  children,
  ...props
}: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant, size, layout }), "h-full min-w-max", className)}
      {...props}>
      {showIcon && icon}
      <span className="text-center text-sm font-medium leading-5">{children}</span>
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { TabsProps, TabsListProps, TabsTriggerProps };
