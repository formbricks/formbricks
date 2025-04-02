import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet",
};

export const AlchemyWalletLayout = async (props) => {
  const { children } = props;

  try {
    return children;
  } catch (error) {
    // The error boundary will catch this
    throw error;
  }
};
