import { ReactNode } from "react";
import { ErrorComponent } from "../ErrorComponent";
import LoadingSpinner from "../LoadingSpinner";

type AccessWrapperProps = {
  isLoading: boolean;
  children: ReactNode;
  error: string;
};

export const LoadingWrapper = ({ isLoading, children, error }: AccessWrapperProps) => {
  if (isLoading) return <LoadingSpinner />;

  if (error.length > 0) {
    console.error(error);
    return <ErrorComponent />;
  }

  return <>{children}</>;
};
