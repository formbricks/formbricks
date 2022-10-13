import { PlusIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import NewFormModal from "../form/NewFormModal";

export default function NewFormNavButton({}) {
  const [openNewFormModal, setOpenNewFormModal] = useState(false);
  return (
    <>
      <button
        type="button"
        className="border-ui-gray-light bg-ui-gray-lighter text-ui-gray-dark hidden items-center border-r text-sm hover:bg-red-500 hover:text-white sm:flex"
        onClick={() => setOpenNewFormModal(true)}>
        <nav className="hidden sm:flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-4">
            <li>
              <div className="inline-flex items-center border border-transparent bg-transparent px-6 py-2 text-sm font-medium leading-4 hover:text-white focus:outline-none">
                <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                create form
              </div>
            </li>
          </ol>
        </nav>
      </button>
      <NewFormModal open={openNewFormModal} setOpen={setOpenNewFormModal} />
    </>
  );
}
