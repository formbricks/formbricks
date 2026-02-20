import { Viewport } from "next";
import { LinkSurveyLayout } from "@/modules/survey/link/layout";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "contain",
};

export default LinkSurveyLayout;
