import Modal from "@/components/shared/Modal";
import { useState } from "react";

interface ModalWithTabsProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  icon?: React.ReactNode;
  label?: string;
  description?: string;
  tabs: TabProps[];
}

type TabProps = {
  title: string;
  children: React.ReactNode;
};

export default function ModalWithTabs({ open, setOpen, tabs, icon, label, description }: ModalWithTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabClick = (index: number) => {
    setActiveTab(index);
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              {icon && <div className="mr-1.5 h-6 w-6 text-slate-500">{icon}</div>}
              <div>
                {label && <div className="text-xl font-medium text-slate-700">{label}</div>}
                {description && <div className="text-sm text-slate-500">{description}</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex  h-full  items-center space-x-2 border-b border-slate-200 px-6 ">
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
    </Modal>
  );
}
