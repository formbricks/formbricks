"use client";

import { useEffect, useRef } from "react";

interface CustomScriptsInjectorProps {
  projectScripts?: string | null;
  surveyScripts?: string | null;
  scriptsMode?: "add" | "replace" | null;
}

/**
 * Injects custom HTML scripts into the document head for link surveys.
 * Supports merging project and survey scripts or replacing project scripts with survey scripts.
 *
 * @param projectScripts - Scripts configured at the workspace/project level
 * @param surveyScripts - Scripts configured at the survey level
 * @param scriptsMode - "add" merges both, "replace" uses only survey scripts
 */
export const CustomScriptsInjector = ({
  projectScripts,
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
      // Add mode (default): merge project and survey scripts
      scriptsToInject = [projectScripts, surveyScripts].filter(Boolean).join("\n");
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
  }, [projectScripts, surveyScripts, scriptsMode]);

  return null;
};
