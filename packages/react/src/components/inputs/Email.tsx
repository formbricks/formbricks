import { useEffectUpdateSchema } from "../../lib/schema";
import { NameRequired, UniversalInputProps } from "../../types";
import { Input, InputProps } from "../shared/Input";

interface EmailUniqueProps {}

type Props = EmailUniqueProps & InputProps & UniversalInputProps & NameRequired;

const inputType = "email";

export function Email(props: Props) {
  useEffectUpdateSchema(props, inputType);

  return <Input type={{ html: inputType, formbricks: inputType }} {...props} />;
}
