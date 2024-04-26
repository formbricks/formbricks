import { Container, Link, Text } from "@react-email/components";
import { Tailwind } from "@react-email/components";
import React from "react";

import { WEBAPP_URL } from "@formbricks/lib/constants";

interface NotificatonFooterProps {
  environmentId: string;
}
export const NotificationFooter = ({ environmentId }: NotificatonFooterProps) => {
  return (
    <Tailwind>
      <Container className="w-full">
        <Text className="mb-0 pt-4 font-medium">All the best,</Text>
        <Text className="mt-0">The Formbricks Team 🤍</Text>
        <Container
          className="mt-0 w-full rounded-md bg-slate-100 px-4 text-center text-xs leading-5"
          style={{ fontStyle: "italic" }}>
          <Text>
            To halt Weekly Updates,{" "}
            <Link
              href={`${WEBAPP_URL}/environments/${environmentId}/settings/notifications`}
              className="text-black underline">
              please turn them off
            </Link>{" "}
            in your settings 🙏
          </Text>
        </Container>
      </Container>
    </Tailwind>
  );
};
