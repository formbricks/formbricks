import { useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { useNoCodeForm } from "../../lib/noCodeForm";
import Loading from "../Loading";
import Page from "./Page";

export default function Builder({ formId }) {
  const { noCodeForm, mutateNoCodeForm, isLoadingNoCodeForm } =
    useNoCodeForm(formId);

  const addPage = useCallback(() => {
    if (noCodeForm) {
      const updatedNCF = JSON.parse(JSON.stringify(noCodeForm));
      updatedNCF.pages.push({
        id: uuidv4(),
        elements: [],
      });
      mutateNoCodeForm(updatedNCF, false);
    }
  }, [mutateNoCodeForm, noCodeForm]);

  useEffect(() => {
    if (noCodeForm && noCodeForm.pages.length === 0) addPage();
  }, [noCodeForm]);

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

  return (
    <div className="w-full bg-gray-100">
      <div className="flex justify-center w-full mt-10">
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 gap-6">
            {noCodeForm.pages.map((page) => (
              <Page key={page.id} />
            ))}
          </div>
          <button
            onClick={() => addPage()}
            className="inline-flex items-center justify-center w-full px-4 py-2 mt-3 text-sm font-medium text-gray-700 border border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
          >
            + Add Page
          </button>
        </div>
      </div>
    </div>
  );
}
