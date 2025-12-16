import { Text } from "@react-email/components";

type TFunction = (key: string, replacements?: Record<string, string>) => string;

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
