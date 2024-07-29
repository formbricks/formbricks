import IframeAutoLoginWithToken from "@/app/admin-iframe/IframeAutoLoginWithToken";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";

const IframeAppLayout = async (props) => {
  const { children } = props;
  const session = await getServerSession(authOptions);

  return <IframeAutoLoginWithToken session={session}>{children}</IframeAutoLoginWithToken>;
};

export default IframeAppLayout;
