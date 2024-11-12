"use client";

import { remToPx } from "@/lib/remToPx";
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
  sections: Array<Section>;
  visibleSections: Array<string>;
  setVisibleSections: (visibleSections: Array<string>) => void;
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

const createSectionStore = (sections: Array<Section>) => {
  return createStore<SectionState>()((set) => ({
    sections,
    visibleSections: [],
    setVisibleSections: (visibleSections) =>
      set((state) => (state.visibleSections.join() === visibleSections.join() ? {} : { visibleSections })),
    registerHeading: ({ id, ref, offsetRem }) =>
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
      }),
  }));
};

const useVisibleSections = (sectionStore: StoreApi<SectionState>) => {
  let setVisibleSections = useStore(sectionStore, (s) => s.setVisibleSections);
  let sections = useStore(sectionStore, (s) => s.sections);

  useEffect(() => {
    const checkVisibleSections = () => {
      let { innerHeight, scrollY } = window;
      let newVisibleSections: string[] = [];

      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
        let { id, headingRef, offsetRem = 0 } = sections[sectionIndex];

        if (!headingRef?.current) {
          continue;
        }

        let offset = remToPx(offsetRem);
        let top = headingRef.current.getBoundingClientRect().top + scrollY;

        if (sectionIndex === 0 && top - offset > scrollY) {
          newVisibleSections.push("_top");
        }

        let nextSection = sections[sectionIndex + 1];
        let bottom =
          (nextSection?.headingRef?.current?.getBoundingClientRect().top ?? Infinity) +
          scrollY -
          remToPx(nextSection?.offsetRem ?? 0);

        if (
          (top > scrollY && top < scrollY + innerHeight) ||
          (bottom > scrollY && bottom < scrollY + innerHeight) ||
          (top <= scrollY && bottom >= scrollY + innerHeight)
        ) {
          newVisibleSections.push(id);
        }
      }

      setVisibleSections(newVisibleSections);
    };

    let raf = window.requestAnimationFrame(() => checkVisibleSections());
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

export const SectionProvider = ({
  sections,
  children,
}: {
  sections: Array<Section>;
  children: React.ReactNode;
}) => {
  let [sectionStore] = useState(() => createSectionStore(sections));

  useVisibleSections(sectionStore);

  useIsomorphicLayoutEffect(() => {
    sectionStore.setState({ sections });
  }, [sectionStore, sections]);

  return <SectionStoreContext.Provider value={sectionStore}>{children}</SectionStoreContext.Provider>;
};

export const useSectionStore = <T,>(selector: (state: SectionState) => T) => {
  const store = useContext(SectionStoreContext);
  return useStore(store!, selector);
};
