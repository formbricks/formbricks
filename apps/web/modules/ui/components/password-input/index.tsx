"use client";

import { cn } from "@/lib/cn";
import { EyeIcon, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  containerClassName?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, containerClassName, ...rest }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const togglePasswordVisibility = () => {
      setShowPassword((prevShowPassword) => !prevShowPassword);
    };
    return (
      <div className={cn("relative", containerClassName)}>
        <input
          ref={ref}
          type={showPassword ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...rest}
        />
        <button
          type="button"
          className={cn("absolute right-3 top-1/2 -translate-y-1/2 transform")}
          onClick={togglePasswordVisibility}>
          {showPassword ? (
            <EyeOff className="h-5 w-5 text-slate-400" />
          ) : (
            <EyeIcon className="h-5 w-5 text-slate-400" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
