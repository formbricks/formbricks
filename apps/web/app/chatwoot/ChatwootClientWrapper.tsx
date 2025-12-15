import { TUser } from "@formbricks/types/user";
import { CHATWOOT_BASE_URL, CHATWOOT_WEBSITE_TOKEN, IS_CHATWOOT_CONFIGURED } from "@/lib/constants";
import { ChatwootWidget } from "./ChatwootWidget";

interface ChatwootClientWrapperProps {
  user?: TUser | null;
}

export const ChatwootClientWrapper = ({ user }: ChatwootClientWrapperProps) => {
  return (
    <ChatwootWidget
      isChatwootConfigured={IS_CHATWOOT_CONFIGURED}
      userEmail={user?.email}
      userName={user?.name}
      userId={user?.id}
      chatwootWebsiteToken={CHATWOOT_WEBSITE_TOKEN}
      chatwootBaseUrl={CHATWOOT_BASE_URL}
    />
  );
};
