"use client";

import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

const PasswordInput = ({ className, ...rest }: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prevShowPassword) => !prevShowPassword);
  };

  return (
    <div className="relative">
      <input
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
          <EyeSlashIcon className="h-5 w-5 text-slate-400 " />
        ) : (
          <EyeIcon className="h-5 w-5 text-slate-400 " />
        )}
      </button>
    </div>
  );
};

export { PasswordInput };
