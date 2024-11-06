import React, { useState } from "react";

interface FollowUpActionMultiEmailInputProps {
  emails: string[];
  setEmails: React.Dispatch<React.SetStateAction<string[]>>;
}

const FollowUpActionMultiEmailInput = ({ emails, setEmails }: FollowUpActionMultiEmailInputProps) => {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Clear error when user starts typing
    if (error) setError("");

    // Handle email addition on Space
    if (e.key === " ") {
      e.preventDefault();
      const email = inputValue.trim();

      if (!email) return;

      // Validate email
      if (!emailRegex.test(email)) {
        setError("Please enter a valid email address");
        return;
      }

      // Check for duplicates
      if (emails.includes(email)) {
        setError("This email has already been added");
        return;
      }

      setEmails([...emails, email]);
      setInputValue("");
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

  return (
    <div className="w-full max-w-2xl">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-300 px-2 py-1">
        {emails.map((email, index) => (
          <div
            key={index}
            className="group flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-1 text-sm">
            <span className="text-slate-900">{email}</span>
            <button
              onClick={() => removeEmail(index)}
              className="px-1 text-lg font-medium leading-none text-slate-500">
              ×
            </button>
          </div>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={emails.length === 0 ? "Write an email & press space bar" : ""}
          className="min-w-[180px] flex-1 border-none p-0 py-1 text-sm placeholder:text-slate-400 focus:ring-0"
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default FollowUpActionMultiEmailInput;
