import { type ComponentType, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";

/** Every view's entry point: one root, one component, the shared theme. */
export const mountView = (View: ComponentType): void => {
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("The view page has no #root element.");
  }
  createRoot(container).render(
    <StrictMode>
      <View />
    </StrictMode>
  );
};
