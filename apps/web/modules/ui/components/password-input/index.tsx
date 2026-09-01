"use client";

import { EyeIcon, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  containerClassName?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, containerClassName, ...rest }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const { t } = useTranslation();

    const togglePasswordVisibility = () => {
      setShowPassword((prevShowPassword) => !prevShowPassword);
    };
    return (
      <div className={cn("relative", containerClassName)}>
        <input
          ref={ref}
          type={showPassword ? "text" : "password"}
          className={cn(
            // text-base below sm keeps iOS Safari from zooming the viewport on focus (ENG-2428);
            // pr-11 reserves room for the toggle's tap target rather than just its icon.
            "flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 pr-11 text-base text-slate-800 placeholder:text-slate-500 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
            className
          )}
          {...rest}
        />
        <button
          type="button"
          // WCAG 2.2 SC 2.5.8 wants at least 24x24 CSS px; the bare icon was 20x20 and had no
          // accessible name at all, so a screen reader announced an unlabelled button.
          className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:outline-hidden"
          aria-label={showPassword ? t("common.hide_password") : t("common.show_password")}
          aria-pressed={showPassword}
          onClick={togglePasswordVisibility}>
          {showPassword ? <EyeOff className="size-5" /> : <EyeIcon className="size-5" />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
