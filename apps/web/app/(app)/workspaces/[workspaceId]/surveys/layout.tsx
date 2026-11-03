import { type ReactNode } from "react";
import { SurveysQueryClientProvider } from "./query-client-provider";

const SurveysLayout = ({ children }: { readonly children: ReactNode }) => {
  return <SurveysQueryClientProvider>{children}</SurveysQueryClientProvider>;
};

export default SurveysLayout;
