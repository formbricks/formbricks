import { Text } from "@react-email/components";
import { TFunction } from "i18next";
import React from "react";

export function EmailFooter({ t }: { t: TFunction }): React.JSX.Element {
  return (
    <Text className="text-sm">
      {t("emails.email_footer_text_1")}
      <br />
      {t("emails.email_footer_text_2")}
    </Text>
  );
}

export default EmailFooter;
