import { ReactNode } from "react";
import { ErrorComponent } from "../ErrorComponent";
import LoadingSpinner from "../LoadingSpinner";

type AccessWrapperProps = {
  loading: boolean;
  children: ReactNode;
  error: string;
};

export const AccessWrapper = ({ loading, children, error }: AccessWrapperProps) => {
  if (loading) return <LoadingSpinner />;

  if (error.length > 0) {
    console.error(error);
    return <ErrorComponent />;
  }

  return <>{children}</>;
};
