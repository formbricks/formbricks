import React from "react";
import { classNames } from "../../lib/utils";
import Link from "next/link";

interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  itemLabel: string;
  disabled?: boolean;
  link?: boolean;
  outbound?: boolean;
  href: string;
}

// button component, consuming props
const SecondNavBarItem: React.FC<Props> = ({
  children,
  onClick = () => {},
  itemLabel,
  disabled = false,
  link = false,
  outbound = false,
  href,
  ...rest
}) => {
  return (
    <div>
      {link ? (
        <Link href={href}>
          <a
            target={outbound ? "_blank" : "_self"}
            className="inline-flex p-2 text-xs bg-transparent rounded-sm hover:bg-ui-gray-light hover:cursor-pointer text-ui-gray-dark hover:text-red"
          >
            <span>{children}</span>
            {itemLabel}
          </a>
        </Link>
      ) : (
        <button
          className={classNames(
            `p-2 text-xs rounded-sm`,
            disabled
              ? "text-ui-gray-medium"
              : "bg-transparent hover:bg-ui-gray-light text-ui-gray-dark hover:text-red"
          )}
          onClick={onClick}
          disabled={disabled}
          {...rest}
        >
          <span>{children}</span>
          {itemLabel}
        </button>
      )}
    </div>
  );
};

export default SecondNavBarItem;
