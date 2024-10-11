"use client";

import { Tag } from "@/components/Tag";
import { Tab } from "@headlessui/react";
import clsx from "clsx";
import { Children, createContext, isValidElement, useContext, useEffect, useRef, useState } from "react";
import { create } from "zustand";

const languageNames: Record<string, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  javascript: "JavaScript",
  typescript: "TypeScript",
  php: "PHP",
  python: "Python",
  ruby: "Ruby",
  go: "Go",
};

const getPanelTitle = ({ title, language }: { title?: string; language?: string }) => {
  if (title) {
    return title;
  }
  if (language && language in languageNames) {
    return languageNames[language];
  }
  return "Code";
};

const ClipboardIcon = (props: React.ComponentPropsWithoutRef<"svg">) => {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...props}>
      <path
        strokeWidth="0"
        d="M5.5 13.5v-5a2 2 0 0 1 2-2l.447-.894A2 2 0 0 1 9.737 4.5h.527a2 2 0 0 1 1.789 1.106l.447.894a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2Z"
      />
      <path
        fill="none"
        strokeLinejoin="round"
        d="M12.5 6.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2m5 0-.447-.894a2 2 0 0 0-1.79-1.106h-.527a2 2 0 0 0-1.789 1.106L7.5 6.5m5 0-1 1h-3l-1-1"
      />
    </svg>
  );
};

const CopyButton = ({ code }: { code: string }) => {
  let [copyCount, setCopyCount] = useState(0);
  let copied = copyCount > 0;

  useEffect(() => {
    if (copyCount > 0) {
      let timeout = setTimeout(() => setCopyCount(0), 1000);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [copyCount]);

  return (
    <button
      type="button"
      className={clsx(
        "group/button text-2xs absolute right-4 top-3.5 overflow-hidden rounded-full py-1 pl-2 pr-3 font-medium opacity-0 backdrop-blur transition focus:opacity-100 group-hover:opacity-100",
        copied
          ? "bg-teal-400/10 ring-1 ring-inset ring-teal-400/20"
          : "hover:bg-white/7.5 dark:bg-white/2.5 bg-white/5 dark:hover:bg-white/5"
      )}
      onClick={() => {
        window.navigator.clipboard.writeText(code).then(() => {
          setCopyCount((count) => count + 1);
        });
      }}>
      <span
        aria-hidden={copied}
        className={clsx(
          "pointer-events-none flex items-center gap-0.5 text-slate-400 transition duration-300",
          copied && "-translate-y-1.5 opacity-0"
        )}>
        <ClipboardIcon className="h-5 w-5 fill-slate-500/20 stroke-slate-500 transition-colors group-hover/button:stroke-slate-400" />
        Copy
      </span>
      <span
        aria-hidden={!copied}
        className={clsx(
          "pointer-events-none absolute inset-0 flex items-center justify-center text-teal-400 transition duration-300",
          !copied && "translate-y-1.5 opacity-0"
        )}>
        Copied!
      </span>
    </button>
  );
};

const CodePanelHeader = ({ tag, label }: { tag?: string; label?: string }) => {
  if (!tag && !label) {
    return null;
  }

  return (
    <div className="border-b-white/7.5 bg-white/2.5 dark:bg-white/1 flex h-9 items-center gap-2 border-y border-t-transparent bg-slate-900 px-4 dark:border-b-white/5">
      {tag && (
        <div className="dark flex">
          <Tag variant="small">{tag}</Tag>
        </div>
      )}
      {tag && label && <span className="h-0.5 w-0.5 rounded-full bg-slate-500" />}
      {label && <span className="font-mono text-xs text-slate-400">{label}</span>}
    </div>
  );
};

const CodePanel = ({
  children,
  tag,
  label,
  code,
}: {
  children: React.ReactNode;
  tag?: string;
  label?: string;
  code?: string;
}) => {
  let child = Children.only(children);

  if (isValidElement(child)) {
    tag = child.props.tag ?? tag;
    label = child.props.label ?? label;
    code = child.props.code ?? code;
  }

  if (!code) {
    throw new Error("`CodePanel` requires a `code` prop, or a child with a `code` prop.");
  }

  return (
    <div className="dark:bg-white/2.5 group">
      <CodePanelHeader tag={tag} label={label} />
      <div className="relative">
        <pre className="overflow-x-auto p-4 text-xs text-white">{children}</pre>
        <CopyButton code={code} />
      </div>
    </div>
  );
};

const CodeGroupHeader = ({
  title,
  children,
  selectedIndex,
}: {
  title: string;
  children: React.ReactNode;
  selectedIndex: number;
}) => {
  let hasTabs = Children.count(children) >= 1;

  if (!title && !hasTabs) {
    return null;
  }

  return (
    <div className="flex min-h-[calc(theme(spacing.12)+1px)] flex-wrap items-start gap-x-4 border-b border-slate-700 bg-slate-800 px-4 dark:border-slate-800 dark:bg-transparent">
      {title && <h3 className="mr-auto pt-3 text-xs font-semibold text-white">{title}</h3>}
      {hasTabs && (
        <Tab.List className="-mb-px flex gap-4 text-xs font-medium">
          {Children.map(children, (child, childIndex) => (
            <Tab
              className={clsx(
                "ui-not-focus-visible:outline-none border-b py-3 transition",
                childIndex === selectedIndex
                  ? "border-teal-500 text-teal-400"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              )}>
              {getPanelTitle(isValidElement(child) ? child.props : {})}
            </Tab>
          ))}
        </Tab.List>
      )}
    </div>
  );
};

const CodeGroupPanels = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof CodePanel>) => {
  let hasTabs = Children.count(children) >= 1;

  if (hasTabs) {
    return (
      <Tab.Panels>
        {Children.map(children, (child) => (
          <Tab.Panel>
            <CodePanel {...props}>{child}</CodePanel>
          </Tab.Panel>
        ))}
      </Tab.Panels>
    );
  }

  return <CodePanel {...props}>{children}</CodePanel>;
};

const usePreventLayoutShift = () => {
  let positionRef = useRef<HTMLElement>(null);
  let rafRef = useRef<number>();

  useEffect(() => {
    return () => {
      if (typeof rafRef.current !== "undefined") {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return {
    positionRef,
    preventLayoutShift(callback: () => void) {
      if (!positionRef.current) {
        return;
      }

      let initialTop = positionRef.current.getBoundingClientRect().top;

      callback();

      rafRef.current = window.requestAnimationFrame(() => {
        let newTop = positionRef.current?.getBoundingClientRect().top ?? initialTop;
        window.scrollBy(0, newTop - initialTop);
      });
    },
  };
};

const usePreferredLanguageStore = create<{
  preferredLanguages: Array<string>;
  addPreferredLanguage: (language: string) => void;
}>()((set) => ({
  preferredLanguages: [],
  addPreferredLanguage: (language) =>
    set((state) => ({
      preferredLanguages: [
        ...state.preferredLanguages.filter((preferredLanguage) => preferredLanguage !== language),
        language,
      ],
    })),
}));

const useTabGroupProps = (availableLanguages: Array<string>) => {
  let { preferredLanguages, addPreferredLanguage } = usePreferredLanguageStore();
  let [selectedIndex, setSelectedIndex] = useState(0);
  let activeLanguage = [...availableLanguages].sort(
    (a, z) => preferredLanguages.indexOf(z) - preferredLanguages.indexOf(a)
  )[0];
  let languageIndex = availableLanguages.indexOf(activeLanguage);
  let newSelectedIndex = languageIndex === -1 ? selectedIndex : languageIndex;
  if (newSelectedIndex !== selectedIndex) {
    setSelectedIndex(newSelectedIndex);
  }

  let { positionRef, preventLayoutShift } = usePreventLayoutShift();

  return {
    as: "div" as const,
    ref: positionRef,
    selectedIndex,
    onChange: (newSelectedIndex: number) => {
      preventLayoutShift(() => addPreferredLanguage(availableLanguages[newSelectedIndex]));
    },
  };
};

const CodeGroupContext = createContext(false);

export const CodeGroup = ({
  children,
  title,
  ...props
}: React.ComponentPropsWithoutRef<typeof CodeGroupPanels> & { title: string }) => {
  let languages =
    Children.map(children, (child) => getPanelTitle(isValidElement(child) ? child.props : {})) ?? [];
  let tabGroupProps = useTabGroupProps(languages);
  let hasTabs = Children.count(children) >= 1;

  let containerClassName =
    "not-prose my-6 overflow-hidden rounded-2xl bg-slate-900 shadow-md dark:ring-1 dark:ring-white/10";
  let header = (
    <CodeGroupHeader title={title} selectedIndex={tabGroupProps.selectedIndex}>
      {children}
    </CodeGroupHeader>
  );
  let panels = <CodeGroupPanels {...props}>{children}</CodeGroupPanels>;

  return (
    <CodeGroupContext.Provider value={true}>
      {hasTabs ? (
        <Tab.Group {...tabGroupProps} className={containerClassName}>
          {header}
          {panels}
        </Tab.Group>
      ) : (
        <div className={containerClassName}>
          {header}
          {panels}
        </div>
      )}
    </CodeGroupContext.Provider>
  );
};

export const Code = ({ children, ...props }: React.ComponentPropsWithoutRef<"code">) => {
  let isGrouped = useContext(CodeGroupContext);

  if (isGrouped) {
    if (typeof children !== "string") {
      throw new Error("`Code` children must be a string when nested inside a `CodeGroup`.");
    }
    return <code {...props} dangerouslySetInnerHTML={{ __html: children }} />;
  }

  return <code {...props}>{children}</code>;
};

export const Pre = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof CodeGroup>) => {
  let isGrouped = useContext(CodeGroupContext);

  if (isGrouped) {
    return children;
  }

  return <CodeGroup {...props}>{children}</CodeGroup>;
};
