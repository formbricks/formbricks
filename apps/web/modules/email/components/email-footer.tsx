import { translateEmailText } from "@/modules/email/lib/utils";
import { Text } from "@react-email/components";

interface EmailFooterProps {
  locale: string;
}

export function EmailFooter({ locale }: EmailFooterProps): React.JSX.Element {
  return (
    <Text>
      {translateEmailText("email_footer_text_1", locale)}
      <br /> {translateEmailText("email_footer_text_2", locale)}
    </Text>
  );
}

export default EmailFooter;
