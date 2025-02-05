import { Text } from "@react-email/components";
import React from "react";

export function EmailFooter({ t }: { t: (s: string) => string }): React.JSX.Element {
  return (
    <Text>
      {t("emails.email_footer_text_1")}
      <br />
      {t("emails.email_footer_text_2")}
    </Text>
  );
}

export default EmailFooter;
