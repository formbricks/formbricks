import { cn } from "@/modules/ui/lib/utils";
import { cva } from "class-variance-authority";
import React, { forwardRef } from "react";

const H1 = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>((props, ref) => {
  return (
    <h1
      {...props}
      ref={ref}
      className={cn(
        "scroll-m-20 text-4xl font-bold tracking-tight text-slate-800 lg:text-4xl",
        props.className
      )}>
      {props.children}
    </h1>
  );
});

H1.displayName = "H1";
export { H1 };

const H2 = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>((props, ref) => {
  return (
    <h2
      {...props}
      ref={ref}
      className={cn(
        "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight text-slate-800 first:mt-0",
        props.className
      )}>
      {props.children}
    </h2>
  );
});

H2.displayName = "H2";
export { H2 };

const H3 = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>((props, ref) => {
  return (
    <h3
      {...props}
      ref={ref}
      className={cn("scroll-m-20 text-lg font-medium text-slate-800", props.className)}>
      {props.children}
    </h3>
  );
});

H3.displayName = "H3";
export { H3 };

const H4 = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>((props, ref) => {
  return (
    <h4
      {...props}
      ref={ref}
      className={cn("scroll-m-20 text-base tracking-tight text-slate-800", props.className)}>
      {props.children}
    </h4>
  );
});

H4.displayName = "H4";
export { H4 };

const Lead = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>((props, ref) => {
  return (
    <p {...props} ref={ref} className={cn("text-muted-foreground text-xl text-slate-800", props.className)}>
      {props.children}
    </p>
  );
});

Lead.displayName = "Lead";
export { Lead };

const P = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>((props, ref) => {
  return (
    <p {...props} ref={ref} className={cn("leading-7 [&:not(:first-child)]:mt-6", props.className)}>
      {props.children}
    </p>
  );
});

P.displayName = "P";
export { P };

const Large = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => {
  return (
    <p {...props} ref={ref} className={cn("text-lg", props.className)}>
      {props.children}
    </p>
  );
});

Large.displayName = "Large";
export { Large };

const Base = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => {
  return (
    <p {...props} ref={ref} className={cn("text-base", props.className)}>
      {props.children}
    </p>
  );
});

Base.displayName = "Base";
export { Base };

const smallVariants = cva("text-sm leading-none", {
  variants: {
    color: {
      default: "text-slate-800 font-medium",
      muted: "text-slate-500",
    },
    margin: {
      default: "mt-0",
      headerDescription: "mt-1",
    },
  },
});

interface SmallProps extends React.HTMLAttributes<HTMLParagraphElement> {
  color?: "default" | "muted";
  margin?: "default" | "headerDescription";
}

const Small = forwardRef<HTMLParagraphElement, SmallProps>((props, ref) => {
  return (
    <p
      {...props}
      ref={ref}
      className={cn(
        smallVariants({ color: props.color ?? "default", margin: props.margin ?? "default" }),
        props.className
      )}>
      {props.children}
    </p>
  );
});

Small.displayName = "Small";
export { Small };

const InlineSmall = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props, ref) => {
  return (
    <span {...props} ref={ref} className={cn("text-sm font-normal", props.className)}>
      {props.children}
    </span>
  );
});

InlineSmall.displayName = "InlineSmall";
export { InlineSmall };

const Muted = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props, ref) => {
  return (
    <span {...props} ref={ref} className={cn("text-muted-foreground text-sm", props.className)}>
      {props.children}
    </span>
  );
});

Muted.displayName = "Muted";
export { Muted };

const InlineCode = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props, ref) => {
  return (
    <code
      {...props}
      ref={ref}
      className={cn(
        "bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
        props.className
      )}>
      {props.children}
    </code>
  );
});

InlineCode.displayName = "InlineCode";
export { InlineCode };

const List = forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>((props, ref) => {
  return (
    <ul {...props} ref={ref} className={cn("my-6 ml-6 list-disc [&>li]:mt-2", props.className)}>
      {props.children}
    </ul>
  );
});

List.displayName = "List";
export { List };

const Quote = forwardRef<HTMLQuoteElement, React.HTMLAttributes<HTMLQuoteElement>>((props, ref) => {
  return (
    <blockquote {...props} ref={ref} className={cn("mt-6 border-l-2 pl-6 italic", props.className)}>
      {props.children}
    </blockquote>
  );
});

Quote.displayName = "Quote";
export { Quote };
