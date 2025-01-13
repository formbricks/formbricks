"use client";

import { remToPx } from "@/lib/rem-to-px";
import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { type StoreApi, createStore, useStore } from "zustand";

export interface Section {
  id: string;
  title: string;
  offsetRem?: number;
  tag?: string;
  headingRef?: React.RefObject<HTMLHeadingElement>;
}

interface SectionState {
  sections: Section[];
  visibleSections: string[];
  setVisibleSections: (visibleSections: string[]) => void;
  registerHeading: ({
    id,
    ref,
    offsetRem,
  }: {
    id: string;
    ref: React.RefObject<HTMLHeadingElement>;
    offsetRem: number;
  }) => void;
}

const createSectionStore = (sections: Section[]) => {
  return createStore<SectionState>()((set) => ({
    sections,
    visibleSections: [],
    setVisibleSections: (visibleSections) => {
      set((state) => (state.visibleSections.join() === visibleSections.join() ? {} : { visibleSections }));
    },
    registerHeading: ({ id, ref, offsetRem }) => {
      set((state) => {
        return {
          sections: state.sections.map((section) => {
            if (section.id === id) {
              return {
                ...section,
                headingRef: ref,
                offsetRem,
              };
            }
            return section;
          }),
        };
      });
    },
  }));
};

const useVisibleSections = (sectionStore: StoreApi<SectionState>) => {
  const setVisibleSections = useStore(sectionStore, (s) => s.setVisibleSections);
  const sections = useStore(sectionStore, (s) => s.sections);

  useEffect(() => {
    const checkVisibleSections = () => {
      const { innerHeight, scrollY } = window;
      const newVisibleSections: string[] = [];

      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
        const { id, headingRef, offsetRem = 0 } = sections[sectionIndex] ?? {};

        if (!headingRef?.current) {
          continue;
        }

        const offset = remToPx(offsetRem);
        const top = headingRef.current.getBoundingClientRect().top + scrollY;

        if (sectionIndex === 0 && top - offset > scrollY) {
          newVisibleSections.push("_top");
        }

        const nextSection = sections[sectionIndex + 1];
        const bottom =
          (nextSection?.headingRef?.current?.getBoundingClientRect().top ?? Infinity) +
          scrollY -
          remToPx(nextSection?.offsetRem ?? 0);

        if (
          (top > scrollY && top < scrollY + innerHeight) ||
          (bottom > scrollY && bottom < scrollY + innerHeight) ||
          (top <= scrollY && bottom >= scrollY + innerHeight)
        ) {
          newVisibleSections.push(id ?? "");
        }
      }

      setVisibleSections(newVisibleSections);
    };

    const raf = window.requestAnimationFrame(() => {
      checkVisibleSections();
    });
    window.addEventListener("scroll", checkVisibleSections, { passive: true });
    window.addEventListener("resize", checkVisibleSections);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", checkVisibleSections);
      window.removeEventListener("resize", checkVisibleSections);
    };
  }, [setVisibleSections, sections]);
};

const SectionStoreContext = createContext<StoreApi<SectionState> | null>(null);

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function SectionProvider({ sections, children }: { sections: Section[]; children: React.ReactNode }) {
  const [sectionStore] = useState(() => createSectionStore(sections));

  useVisibleSections(sectionStore);

  useIsomorphicLayoutEffect(() => {
    sectionStore.setState({ sections });
  }, [sectionStore, sections]);

  return <SectionStoreContext.Provider value={sectionStore}>{children}</SectionStoreContext.Provider>;
}

export const useSectionStore = <T,>(selector: (state: SectionState) => T): T => {
  const store = useContext(SectionStoreContext);
  if (!store) {
    throw new Error("useSectionStore must be used within a SectionProvider");
  }
  return useStore(store, selector);
};
