import { Container, Link, Tailwind, Text } from "@react-email/components";
import React from "react";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { translateEmailText } from "../../lib/utils";

interface NotificatonFooterProps {
  environmentId: string;
  locale: string;
}
export function NotificationFooter({ environmentId, locale }: NotificatonFooterProps): React.JSX.Element {
  return (
    <Tailwind>
      <Container className="w-full">
        <Text className="mb-0 pt-4 font-medium">
          {translateEmailText("notification_footer_all_the_best", locale)}
        </Text>
        <Text className="mt-0">{translateEmailText("notification_footer_the_formbricks_team", locale)}</Text>
        <Container
          className="mt-0 w-full rounded-md bg-slate-100 px-4 text-center text-xs leading-5"
          style={{ fontStyle: "italic" }}>
          <Text>
            {translateEmailText("notification_footer_to_halt_weekly_updates", locale)}
            <Link
              className="text-black underline"
              href={`${WEBAPP_URL}/environments/${environmentId}/settings/notifications`}>
              {translateEmailText("notification_footer_please_turn_them_off", locale)}
            </Link>{" "}
            {translateEmailText("notification_footer_in_your_settings", locale)} 🙏
          </Text>
        </Container>
      </Container>
    </Tailwind>
  );
}
