"use client";

import { Toaster } from "react-hot-toast";

export const ToasterClient = () => {
  return (
    <Toaster
      toastOptions={{
        success: { className: "formbricks__toast__success" },
        error: {
          className: "formbricks__toast__error",
        },
      }}
    />
  );
};
