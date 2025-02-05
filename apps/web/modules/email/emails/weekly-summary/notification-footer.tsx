import { getTranslate } from "@/tolgee/server";
import { Container, Link, Tailwind, Text } from "@react-email/components";
import React from "react";
import { WEBAPP_URL } from "@formbricks/lib/constants";

interface NotificatonFooterProps {
  environmentId: string;
}
export async function NotificationFooter({
  environmentId,
}: NotificatonFooterProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <Tailwind>
      <Container className="w-full">
        <Text className="mb-0 pt-4 font-medium">{t("emails.notification_footer_all_the_best")}</Text>
        <Text className="mt-0">{t("emails.notification_footer_the_formbricks_team")}</Text>
        <Container
          className="mt-0 w-full rounded-md bg-slate-100 px-4 text-center text-xs leading-5"
          style={{ fontStyle: "italic" }}>
          <Text>
            {t("emails.notification_footer_to_halt_weekly_updates")}
            <Link
              className="text-black underline"
              href={`${WEBAPP_URL}/environments/${environmentId}/settings/notifications`}>
              {t("emails.notification_footer_please_turn_them_off")}
            </Link>{" "}
            {t("emails.notification_footer_in_your_settings")} 🙏
          </Text>
        </Container>
      </Container>
    </Tailwind>
  );
}
