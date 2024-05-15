import "@docsearch/css";
import { DocSearchModal, useDocSearchKeyboardEvents } from "@docsearch/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const docSearchConfig = {
  appId: process.env.NEXT_PUBLIC_DOCSEARCH_APP_ID || "",
  apiKey: process.env.NEXT_PUBLIC_DOCSEARCH_API_KEY || "",
  indexName: process.env.NEXT_PUBLIC_DOCSEARCH_INDEX_NAME || "",
};

interface HitProps {
  hit: { url: string };
  children: React.ReactNode;
}

const Hit = ({ hit, children }: HitProps) => {
  return <Link href={hit.url}>{children}</Link>;
};

const SearchIcon = (props: any) => {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" {...props}>
      <path d="M16.293 17.707a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM9 14a5 5 0 0 1-5-5H2a7 7 0 0 0 7 7v-2ZM4 9a5 5 0 0 1 5-5V2a7 7 0 0 0-7 7h2Zm5-5a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7v2Zm8.707 12.293-3.757-3.757-1.414 1.414 3.757 3.757 1.414-1.414ZM14 9a4.98 4.98 0 0 1-1.464 3.536l1.414 1.414A6.98 6.98 0 0 0 16 9h-2Zm-1.464 3.536A4.98 4.98 0 0 1 9 14v2a6.98 6.98 0 0 0 4.95-2.05l-1.414-1.414Z" />
    </svg>
  );
};

export const Search = () => {
  let { resolvedTheme } = useTheme();
  let isLightMode = resolvedTheme === "light";

  let [isOpen, setIsOpen] = useState(false);
  let [modifierKey, setModifierKey] = useState<string>();

  const onOpen = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);

  const onClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  useDocSearchKeyboardEvents({ isOpen, onOpen, onClose });

  useEffect(() => {
    setModifierKey(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ? "⌘" : "Ctrl ");
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = ` 
      :root {
        --docsearch-primary-color: ${isLightMode ? "#00C4B8" : "#00C4B8"};
        --docsearch-modal-background: ${isLightMode ? "#f8fafc" : "#0f172a"};
        --docsearch-text-color: ${isLightMode ? "#121212" : "#FFFFFF"};
        --docsearch-hit-background: ${isLightMode ? "#FFFFFF" : "#111111"};
        --docsearch-footer-background: ${isLightMode ? "#EEEEEE" : "#121212"};
        --docsearch-searchbox-focus-background: ${isLightMode ? "#f1f5f9" : "#1e293b"};
        --docsearch-modal-shadow: "";
        --DocSearch-Input: ${isLightMode ? "#000000" : "#FFFFFF"};
      }
      .DocSearch-Hit-title {
        color: ${isLightMode ? "#000000" : "#FFFFFF"};
      }
      .DocSearch-Modal {
        margin: 16rem auto auto;
      }
      [type='search']:focus {
        --tw-ring-color: none;
      }
      .DocSearch-Button-Container {
        width: 200px !important;
      }
      .DocSearch-Hit-Container {
        color: var(--color-text-primary);
      }
      .DocSearch-Input {
        outline: none;
      }
      .DocSearch-Screen-Icon {
        visibility: hidden;
      }
      #docsearch-input {
        background-color: transparent;
      }
      .DocSearch-Footer {
        display: none !important;
      }
      
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [isLightMode]);

  return (
    <>
      <button
        type="button"
        className="group flex h-6 w-6 items-center justify-center sm:justify-start md:h-auto md:w-60 md:flex-none md:rounded-lg md:py-2.5 md:pl-4 md:pr-3.5 md:text-sm md:ring-1 md:ring-slate-200 md:hover:ring-slate-300 xl:w-80 dark:text-slate-400 dark:ring-inset dark:ring-white/10 dark:hover:ring-white/20"
        onClick={onOpen}>
        <SearchIcon className="h-5 w-5 flex-none fill-slate-400 group-hover:fill-slate-500 md:group-hover:fill-slate-400 dark:fill-slate-500" />
        <span className="sr-only md:not-sr-only md:pl-2 md:text-slate-500 md:dark:text-slate-400">
          Search docs
        </span>
        {modifierKey && (
          <kbd className="ml-auto hidden font-medium text-slate-400 md:block dark:text-slate-500">
            <kbd className="font-sans">{modifierKey}</kbd>
            <kbd className="font-sans">K</kbd>
          </kbd>
        )}
      </button>
      {isOpen &&
        createPortal(
          <DocSearchModal
            {...docSearchConfig}
            initialScrollY={window.scrollY}
            onClose={onClose}
            hitComponent={Hit}
            navigator={{
              navigate({ itemUrl }) {
                window.location.href = itemUrl;
              },
            }}
          />,
          document.body
        )}
    </>
  );
};
