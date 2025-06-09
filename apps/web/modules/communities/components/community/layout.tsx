import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community",
};

export const CommunityLayout = async (props) => {
  const { children } = props;

  try {
    return children;
  } catch (error) {
    // The error boundary will catch this
    throw error;
  }
};
