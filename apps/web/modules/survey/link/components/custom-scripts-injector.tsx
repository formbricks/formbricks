"use client";

import { useEffect, useRef } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface CustomScriptsInjectorProps {
  workspaceScripts?: string | null;
  surveyScripts?: string | null;
  scriptsMode?: TSurvey["customHeadScriptsMode"];
}

/**
 * Injects custom HTML scripts into the document head for link surveys.
 * Supports merging workspace and survey scripts or replacing workspace scripts with survey scripts.
 *
 * @param workspaceScripts - Scripts configured at the workspace level
 * @param surveyScripts - Scripts configured at the survey level
 * @param scriptsMode - "add" merges both, "replace" uses only survey scripts
 */
export const CustomScriptsInjector = ({
  workspaceScripts,
  surveyScripts,
  scriptsMode,
}: CustomScriptsInjectorProps) => {
  const injectedRef = useRef(false);

  useEffect(() => {
    // Prevent double injection in React strict mode
    if (injectedRef.current) return;

    // Determine which scripts to inject based on mode
    let scriptsToInject: string;

    if (scriptsMode === "replace" && surveyScripts) {
      // Replace mode: only use survey scripts
      scriptsToInject = surveyScripts;
    } else {
      // Add mode (default): merge workspace and survey scripts
      scriptsToInject = [workspaceScripts, surveyScripts].filter(Boolean).join("\n");
    }

    if (!scriptsToInject.trim()) return;

    try {
      // Create a temporary container to parse the HTML
      const container = document.createElement("div");
      container.innerHTML = scriptsToInject;

      // Process and inject script elements
      const scripts = container.querySelectorAll("script");
      scripts.forEach((script) => {
        const newScript = document.createElement("script");

        // Copy all attributes (src, async, defer, type, etc.)
        Array.from(script.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });

        // Copy inline script content
        if (script.textContent) {
          newScript.textContent = script.textContent;
        }

        document.head.appendChild(newScript);
      });

      // Process and inject non-script elements (noscript, meta, link, style, etc.)
      const nonScripts = container.querySelectorAll(":not(script)");
      nonScripts.forEach((el) => {
        const clonedEl = el.cloneNode(true) as Element;
        document.head.appendChild(clonedEl);
      });

      injectedRef.current = true;
    } catch (error) {
      // Log error but don't break the survey - self-hosted admins can check console
      console.warn("[Formbricks] Error injecting custom scripts:", error);
    }
  }, [workspaceScripts, surveyScripts, scriptsMode]);

  return null;
};
