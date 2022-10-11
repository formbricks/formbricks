import {
  AtSymbolIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  HashtagIcon,
  Bars4Icon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import { IoMdRadioButtonOn } from "react-icons/io";
import { classNames } from "../../../lib/utils";

export const elementTypes = [
  {
    type: "email",
    icon: AtSymbolIcon,
  },
  {
    type: "number",
    icon: HashtagIcon,
  },
  {
    type: "phone",
    icon: PhoneIcon,
  },
  {
    type: "text",
    icon: Bars4Icon,
  },
  {
    type: "textarea",
    icon: Bars4Icon,
  },
  {
    type: "checkbox",
    icon: CheckCircleIcon,
  },
  {
    type: "radio",
    icon: IoMdRadioButtonOn,
  },
  {
    type: "website",
    icon: GlobeAltIcon,
  },
];

export const getElementTypeIcon = (type) => {
  const elementType = elementTypes.find((e) => e.type === type);
  return elementType ? (
    <span className={classNames(`text-white`, `bg-red-500`, "inline-flex rounded-lg p-3 ring-4 ring-white")}>
      <elementType.icon className="h-4 w-4" aria-hidden="true" />
    </span>
  ) : null;
};

export default function BaseResults({ element, children }) {
  return (
    <div className="my-8 overflow-hidden rounded-lg bg-white shadow">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">{getElementTypeIcon(element.type)}</div>
          <div className="ml-4">
            <h3 className="text-md font-medium leading-6 text-gray-900">{element.label}</h3>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
