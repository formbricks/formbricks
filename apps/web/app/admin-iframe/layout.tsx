import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";

const IframeAppLayout = async (props) => {
  const { children } = props;

  return <ResponseFilterProvider>{children}</ResponseFilterProvider>;
};

export default IframeAppLayout;
