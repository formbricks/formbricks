import { ChainProvider } from "@/modules/discover/context/chain-context";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover",
};

export const DiscoverLayout = async (props) => {
  const { children } = props;

  try {
    return <ChainProvider>{children}</ChainProvider>;
  } catch (error) {
    // The error boundary will catch this
    throw error;
  }
};
