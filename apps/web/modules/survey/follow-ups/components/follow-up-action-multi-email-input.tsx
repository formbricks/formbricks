import React, { useState } from "react";
import { isValidEmail } from "@/lib/utils/email";
import { cn } from "@/modules/ui/lib/utils";

interface FollowUpActionMultiEmailInputProps {
  emails: string[];
  setEmails: React.Dispatch<React.SetStateAction<string[]>>;
  isInvalid?: boolean;
  disabled?: boolean;
}

const FollowUpActionMultiEmailInput = ({
  emails,
  setEmails,
  isInvalid,
  disabled,
}: FollowUpActionMultiEmailInputProps) => {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  const handleAddEmail = () => {
    const email = inputValue.trim();

    if (!email) return;

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (emails.includes(email)) {
      setError("This email has already been added");
      return;
    }

    setEmails([...emails, email]);
    setInputValue("");
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Clear error when user starts typing
    if (error) setError("");

    // Handle email addition on Space or Comma
    if (e.key === " " || e.key === ",") {
      e.preventDefault();
      handleAddEmail();
    }

    // Handle backspace to remove last email
    if (e.key === "Backspace" && inputValue === "" && emails.length > 0) {
      const newEmails = [...emails];
      setEmails(newEmails.slice(0, -1));
    }
  };

  const removeEmail = (indexToRemove: number) => {
    setEmails(emails.filter((_, index) => index !== indexToRemove));
  };

  const handleInputBlur = () => {
    handleAddEmail();
  };

  return (
    <div className={cn("w-full max-w-2xl")}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-md border px-2 py-1",
          isInvalid ? "border-red-500" : "border-slate-300",
          disabled && "bg-slate-50"
        )}>
        {emails.map((email, index) => (
          <div
            key={index}
            className="group flex items-center gap-1 rounded-sm border border-slate-200 bg-slate-100 px-2 py-1 text-sm">
            <span className="text-slate-900">{email}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeEmail(index)}
              className="px-1 text-lg leading-none font-medium text-slate-500 disabled:opacity-50">
              ×
            </button>
          </div>
        ))}
        <input
          type="text"
          disabled={disabled}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          placeholder={emails.length === 0 ? "Write an email & press space bar" : ""}
          className="min-w-[180px] flex-1 border-none p-0 py-1 text-sm placeholder:text-slate-400 focus:ring-0"
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default FollowUpActionMultiEmailInput;
