/**
 * Ensures document.body is available before proceeding
 * Returns a promise that resolves when document.body exists
 */
export const ensureBodyExists = (): Promise<void> => {
  return new Promise((resolve) => {
    if (document.body) {
      resolve();
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    } else {
      const checkBody = () => {
        if (document.body) {
          resolve();
        } else {
          requestAnimationFrame(checkBody);
        }
      };
      checkBody();
    }
  });
};
