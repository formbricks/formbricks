import { type ReactNode } from "react";
import { ContactsQueryClientProvider } from "@/modules/ee/contacts/components/contacts-query-client-provider";

const ContactsLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return <ContactsQueryClientProvider>{children}</ContactsQueryClientProvider>;
};

export default ContactsLayout;
