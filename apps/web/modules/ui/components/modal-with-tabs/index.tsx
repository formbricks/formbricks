import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { useEffect, useState } from "react";

interface ModalWithTabsProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  icon?: React.ReactNode;
  label?: string;
  description?: string;
  tabs: TabProps[];
  closeOnOutsideClick?: boolean;
}

interface TabProps {
  title: string;
  children: React.ReactNode;
}

export const ModalWithTabs = ({
  open,
  setOpen,
  tabs,
  icon,
  label,
  description,
  closeOnOutsideClick,
}: ModalWithTabsProps) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabClick = (index: number) => {
    setActiveTab(index);
  };

  useEffect(() => {
    if (!open) {
      setActiveTab(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent disableCloseOnOutsideClick={closeOnOutsideClick}>
        <DialogHeader>
          {icon}
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex h-full w-full items-center justify-center space-x-2 border-b border-slate-200 px-6">
            {tabs.map((tab, index) => (
              <button
                key={index}
                className={`mr-4 px-1 pb-3 focus:outline-none ${
                  activeTab === index
                    ? "border-brand-dark border-b-2 font-semibold text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => handleTabClick(index)}>
                {tab.title}
              </button>
            ))}
          </div>
          <div className="flex-1 pt-4">{tabs[activeTab].children}</div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
