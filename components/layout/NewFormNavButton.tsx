import { PlusIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import NewFormModal from "../form/NewFormModal";
import { UserRole } from "@prisma/client";
import { useSession, signIn } from "next-auth/react";

export default function NewFormNavButton({}) {
  const [openNewFormModal, setOpenNewFormModal] = useState(false);
  const { data: session } = useSession({
      
    required: true,
    onUnauthenticated() {
      // The user is not authenticated, handle it here.
      return signIn();
    },
  });
  return (
    <>
      <button
        type="button"
        className="items-center hidden text-sm border-r border-ui-gray-light sm:flex bg-ui-gray-lighter text-ui-gray-dark hover:text-white hover:bg-red-500"
        onClick={() => setOpenNewFormModal(true)}
      >
        <nav className="hidden sm:flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-4">
            {session.user.role!==UserRole.ADMIN ? <></> : (<li>
              <div className="inline-flex items-center px-6 py-2 text-sm font-medium leading-4 bg-transparent border border-transparent hover:text-white focus:outline-none">
                <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                create form
              </div>
            </li>)}
          </ol>
        </nav>
      </button>
      <NewFormModal open={openNewFormModal} setOpen={setOpenNewFormModal} />
    </>
  );
}
