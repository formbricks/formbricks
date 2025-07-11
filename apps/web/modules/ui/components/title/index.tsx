import { cva } from "class-variance-authority";

const titleVariants = cva("font-medium leading-6 text-slate-900", {
  variants: {
    capitalize: {
      true: "capitalize",
    },

    size: {
      default: "text-lg",

      md: "text-base",
    },
  },
});

interface TitleProps {
  children: React.ReactNode;

  capitalize?: boolean;

  size?: "default" | "md";
}

export const Title = ({ children, capitalize = false, size = "default" }: TitleProps) => {
  return <h3 className={titleVariants({ capitalize, size })}>{children}</h3>;
};
