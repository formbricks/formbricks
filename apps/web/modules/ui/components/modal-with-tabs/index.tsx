// import { Modal } from "@/modules/ui/components/modal";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/modules/ui/components/dialog";
import { useEffect, useState } from "react";

interface ModalWithTabsProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  icon?: React.ReactNode;
  label?: string;
  description?: string;
  tabs: TabProps[];
  closeOnOutsideClick?: boolean;
  size?: "md" | "lg";
  restrictOverflow?: boolean;
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
  // size = "lg",
  restrictOverflow = false,
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
    <Dialog open={open}>
      <DialogContent
        // setOpen={setOpen}
        // noPadding
        disableCloseOnOutsideClick={closeOnOutsideClick}
        // size={size}
        // restrictOverflow={restrictOverflow}
      >
        <div className="flex h-full flex-col rounded-lg">
          <div className="rounded-t-lg bg-slate-100">
            <div className="mr-20 flex items-center justify-between truncate p-6">
              <div className="flex items-center space-x-2">
                {icon && <div className="mr-1.5 h-6 w-6 text-slate-500">{icon}</div>}
                <div>
                  {label && <div className="text-xl font-medium text-slate-700">{label}</div>}
                  {description && <div className="text-sm text-slate-500">{description}</div>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex h-full w-full items-center justify-center space-x-2 border-b border-slate-200 px-6">
            {tabs.map((tab, index) => (
              <button
                key={index}
                className={`mr-4 px-1 pb-3 pt-6 focus:outline-none ${
                  activeTab === index
                    ? "border-brand-dark border-b-2 font-semibold text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => handleTabClick(index)}>
                {tab.title}
              </button>
            ))}
          </div>
          <div className="flex-1 p-6">{tabs[activeTab].children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
