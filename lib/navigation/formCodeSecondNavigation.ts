import {
  DocumentMagnifyingGlassIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { FaReact } from "react-icons/fa";

export const useCodeSecondNavigation = (formId) => {
  const router = useRouter();
  return [
    {
      id: "formId",
      onClick: () => {
        router.push(`/forms/${formId}/form`);
      },
      Icon: CommandLineIcon,
      label: "Form ID",
    },
    {
      id: "react",
      onClick: () => {
        router.push(`/forms/${formId}/form/react`);
      },
      Icon: FaReact,
      label: "React",
    },
    {
      id: "reactNative",
      onClick: () => {},
      Icon: FaReact,
      label: "React Native",
      disabled: true,
    },
    {
      id: "vueJs",
      onClick: () => {},
      Icon: CommandLineIcon,
      label: "VueJs",
      disabled: true,
    },
    {
      id: "docs",
      onClick: () => {
        window.open("https://docs.snoopforms.com", "_ blank");
      },
      Icon: DocumentMagnifyingGlassIcon,
      label: "Docs",
    },
  ];
};
