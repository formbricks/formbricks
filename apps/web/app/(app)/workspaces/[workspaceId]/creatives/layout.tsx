import { type ReactNode } from "react";
import { CreativesQueryClientProvider } from "./query-client-provider";

const CreativesLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return <CreativesQueryClientProvider>{children}</CreativesQueryClientProvider>;
};

export default CreativesLayout;
