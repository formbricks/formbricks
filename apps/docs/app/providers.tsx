"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { useEffect } from "react";

const ThemeWatcher = () => {
  let { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    let media = window.matchMedia("(prefers-color-scheme: dark)");

    const onMediaChange = () => {
      let systemTheme = media.matches ? "dark" : "light";
      if (resolvedTheme === systemTheme) {
        setTheme("system");
      }
    };

    onMediaChange();
    media.addEventListener("change", onMediaChange);

    return () => {
      media.removeEventListener("change", onMediaChange);
    };
  }, [resolvedTheme, setTheme]);

  return null;
};

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" disableTransitionOnChange>
      <ThemeWatcher />
      {children}
    </ThemeProvider>
  );
};
