"use client";

import { useEffect, useRef } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface CustomScriptsInjectorProps {
  projectScripts?: string | null;
  surveyScripts?: string | null;
  scriptsMode?: TSurvey["customHeadScriptsMode"];
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

    /**
     * Ensures document.body exists before executing the injection.
     * This prevents race conditions where custom scripts try to access document.body
     * before React hydration completes, which would cause:
     * - React error #454 (missing document.body)
     * - TypeError: can't access property "removeChild" of null
     */
    const ensureBodyExists = (): Promise<void> => {
      return new Promise((resolve) => {
        // If body already exists, resolve immediately
        if (document.body) {
          resolve();
          return;
        }

        // Wait for DOMContentLoaded
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
        } else {
          // Document is already loaded but body doesn't exist yet (edge case)
          // Use setTimeout to defer until next tick
          setTimeout(() => resolve(), 0);
        }
      });
    };

    /**
     * Wraps inline script content to ensure safe execution after DOM is ready.
     * This prevents scripts from executing before document.body is available.
     */
    const wrapScriptContent = (content: string): string => {
      // Don't wrap if the script already has DOM-ready checks
      if (
        content.includes("DOMContentLoaded") ||
        content.includes("document.readyState") ||
        content.includes("window.addEventListener('load'")
      ) {
        return content;
      }

      // Wrap the script to ensure it runs after DOM is ready
      return `
        (function() {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
              ${content}
            });
          } else {
            ${content}
          }
        })();
      `;
    };

    const injectScripts = async () => {
      try {
        // Wait for document.body to exist before injecting any scripts
        await ensureBodyExists();

        // Defensive check: ensure body still exists
        if (!document.body) {
          console.warn("[Formbricks] document.body is not available, skipping script injection");
          return;
        }

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

          // Copy inline script content with safety wrapper
          if (script.textContent) {
            // Only wrap inline scripts (not external scripts with src attribute)
            if (!script.hasAttribute("src")) {
              newScript.textContent = wrapScriptContent(script.textContent);
            } else {
              newScript.textContent = script.textContent;
            }
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
    };

    injectScripts();
  }, [projectScripts, surveyScripts, scriptsMode]);

  return null;
};
