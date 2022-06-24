import { PlusIcon } from "@heroicons/react/outline";
import { useState } from "react";
import NewFormModal from "../form/NewFormModal";

export default function NewFormNavButton({}) {
  const [openNewFormModal, setOpenNewFormModal] = useState(false);
  return (
    <>
      <button
        type="button"
        className="items-center hidden text-sm border-r border-ui-gray-light sm:flex bg-ui-gray-lighter text-ui-gray-dark hover:text-white hover:bg-red-500"
        onClick={() => setOpenNewFormModal(true)}
      >
        <nav className="hidden lg:flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-4">
            <li>
              <div className="inline-flex items-center px-6 py-2 text-sm font-medium leading-4 bg-transparent border border-transparent hover:text-white focus:outline-none">
                <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                Start New Form
              </div>
            </li>
          </ol>
        </nav>
      </button>
      <NewFormModal open={openNewFormModal} setOpen={setOpenNewFormModal} />
    </>
  );
}
