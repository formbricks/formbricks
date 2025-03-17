import { createHmac } from "crypto";
import { INTERCOM_APP_ID, INTERCOM_SECRET_KEY, IS_INTERCOM_CONFIGURED } from "@formbricks/lib/constants";
import type { TUser } from "@formbricks/types/user";
import { IntercomClient } from "./IntercomClient";

interface IntercomClientWrapperProps {
  user?: TUser | null;
}

export const IntercomClientWrapper = ({ user }: IntercomClientWrapperProps) => {
  let intercomUserHash: string | undefined;
  if (user) {
    const secretKey = INTERCOM_SECRET_KEY;
    if (secretKey) {
      intercomUserHash = createHmac("sha256", secretKey).update(user.id).digest("hex");
    }
  }
  return (
    <IntercomClient
      isIntercomConfigured={IS_INTERCOM_CONFIGURED}
      user={user}
      intercomAppId={INTERCOM_APP_ID}
      intercomUserHash={intercomUserHash}
    />
  );
};
