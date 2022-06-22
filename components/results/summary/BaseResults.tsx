import { CheckCircleIcon, MenuAlt1Icon } from "@heroicons/react/outline";
import { classNames } from "../../../lib/utils";

export const elementTypes = [
  {
    type: "text",
    icon: MenuAlt1Icon,
  },
  {
    type: "textarea",
    icon: MenuAlt1Icon,
  },
  {
    type: "checkbox",
    icon: CheckCircleIcon,
  },
];

export const getElementTypeIcon = (type) => {
  const elementType = elementTypes.find((e) => e.type === type);
  return elementType ? (
    <span
      className={classNames(
        `text-white`,
        `bg-snoopred-500`,
        "rounded-lg inline-flex p-3 ring-4 ring-white"
      )}
    >
      <elementType.icon className="w-4 h-4" aria-hidden="true" />
    </span>
  ) : null;
};

export default function BaseResults({ element, children }) {
  return (
    <div className="my-8 overflow-hidden bg-white rounded-lg shadow">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {getElementTypeIcon(element.type)}
          </div>
          <div className="ml-4">
            <h3 className="font-medium leading-6 text-gray-900 text-md">
              {element.label}
            </h3>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
