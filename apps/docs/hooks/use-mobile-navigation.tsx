import { createContext, useContext } from "react";
import { create } from "zustand";

export const IsInsideMobileNavigationContext = createContext(false);

export const useIsInsideMobileNavigation = (): boolean => {
  return useContext(IsInsideMobileNavigationContext);
};

export const useMobileNavigationStore = create<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}>()((set) => ({
  isOpen: false,
  open: () => {
    set({ isOpen: true });
  },
  close: () => {
    set({ isOpen: false });
  },
  toggle: () => {
    set((state) => ({ isOpen: !state.isOpen }));
  },
}));
