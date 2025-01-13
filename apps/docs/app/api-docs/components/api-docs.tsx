"use client";

import { Button } from "@/components/button";
import { LoadingSpinner } from "@/components/icons/loading-spinner";
import { useTheme } from "next-themes";
import { useState } from "react";
import { RedocStandalone } from "redoc";
import "./style.css";

export function ApiDocs() {
  const { resolvedTheme } = useTheme();

  const redocTheme = {
    hideDownloadButton: true,
    hideLoading: true,
    nativeScrollbars: true,
    theme: {
      sidebar: {
        backgroundColor: "transparent",
        textColor: resolvedTheme === "dark" ? "rgb(203, 213, 225)" : "rgb(51, 51, 51)",
        activeTextColor: "#2dd4bf",
      },
      rightPanel: {
        backgroundColor: "transparent",
      },
      colors: {
        primary: { main: "#2dd4bf" },
        text: {
          primary: resolvedTheme === "dark" ? "#ffffff" : "rgb(51, 51, 51)",
        },
        responses: {
          success: { color: "#22c55e" },
          error: { color: "#ef4444" },
          info: { color: "#3b82f6" },
        },
      },
      typography: {
        fontSize: "16px",
        lineHeight: "2rem",
        fontFamily: "Jost, system-ui, -apple-system, sans-serif",
        headings: {
          fontFamily: "Jost, system-ui, -apple-system, sans-serif",
          fontWeight: "600",
        },
        code: {
          fontSize: "16px",
          fontFamily: "ui-monospace, monospace",
        },
      },
      codeBlock: {
        backgroundColor: "rgb(24, 35, 58)",
      },
      spacing: { unit: 5 },
    },
  };

  const [loading, setLoading] = useState(true);

  return (
    <div className="px-4">
      <Button href="/developer-docs/rest-api" arrow="left" className="mb-4 mt-8">
        Back to docs
      </Button>
      <RedocStandalone
        specUrl="/docs/openapi.yaml"
        onLoaded={() => {
          setLoading(false);
        }}
        options={redocTheme}
      />
      {loading ? <LoadingSpinner /> : null}
    </div>
  );
}
