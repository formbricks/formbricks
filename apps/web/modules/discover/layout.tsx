import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover",
};

export const DiscoverLayout = async (props) => {
  const { children } = props;

  try {
    return children;
  } catch (error) {
    // The error boundary will catch this
    throw error;
  }
};
