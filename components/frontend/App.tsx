import { SnoopElement, SnoopForm, SnoopPage } from "@snoopforms/react";
import { useMemo } from "react";
import { useNoCodeForm } from "../../lib/noCodeForm";
import Loading from "../Loading";

export default function App({ id = "", formId, draft = false }) {
  const { noCodeForm, isLoadingNoCodeForm } = useNoCodeForm(formId);
  const pages = useMemo(() => {
    if (!isLoadingNoCodeForm) {
      return noCodeForm[draft ? "pagesDraft" : "pages"];
    }
  }, [draft, isLoadingNoCodeForm, noCodeForm]);

  if (!pages) {
    return <Loading />;
  }

  return (
    <div className="w-full px-5 py-5">
      <SnoopForm
        key={id} // used to reset form
        domain={window.location.host}
        protocol={window.location.protocol === "http:" ? "http" : "https"}
        formId={formId}
        localOnly={draft}
        className="w-full max-w-3xl mx-auto space-y-6"
      >
        {pages.map((page) => (
          <SnoopPage key={page.id} name={page.id}>
            {page.blocks.map((block) => (
              <div key={block.id}>
                {block.type === "paragraph" ? (
                  <p key={block.id}>{block.data.text}</p>
                ) : block.type === "textQuestion" ? (
                  <SnoopElement
                    type="text"
                    name={block.id}
                    label={block.data.label}
                    classNames={{
                      label: "mt-4 block text-base font-medium text-gray-800",
                      element:
                        "flex-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full min-w-0 rounded-md sm:text-base border-gray-300",
                    }}
                    required
                  />
                ) : block.type === "submitButton" ? (
                  <SnoopElement
                    name="submit"
                    type="submit"
                    label={block.data.label}
                    classNames={{
                      button:
                        "flex justify-center px-4 py-2 mt-5 text-base font-medium text-white border border-transparent rounded-md shadow-sm bg-gray-700 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700",
                    }}
                  />
                ) : null}
              </div>
            ))}
          </SnoopPage>
        ))}
      </SnoopForm>
    </div>
  );
}
