"use client";

import { Toaster } from "react-hot-toast";

const toastStyle = {
  maxWidth: "32rem",
} as const;

export const ToasterClient = () => {
  return (
    <Toaster
      toastOptions={{
        style: toastStyle,
        success: { className: "formbricks__toast__success" },
        error: {
          className: "formbricks__toast__error whitespace-pre-line",
          style: toastStyle,
        },
      }}
    />
  );
};
