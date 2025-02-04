import { getTranslate } from "@/tolgee/server";
import { Text } from "@react-email/components";
import React from "react";

export async function EmailFooter(): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <Text>
      {t("emails.email_footer_text_1")}
      <br /> {t("emails.email_footer_text_2")}
    </Text>
  );
}

export default EmailFooter;
