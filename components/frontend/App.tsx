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
                  <p className="ce-paragraph">{block.data.text}</p>
                ) : block.type === "header" ? (
                  block.data.level === 1 ? (
                    <h1 className="ce-header">{block.data.text}</h1>
                  ) : block.level === 2 ? (
                    <h2 className="ce-header">{block.data.text}</h2>
                  ) : block.data.level === 3 ? (
                    <h3 className="ce-header">{block.data.text}</h3>
                  ) : null
                ) : block.type === "textQuestion" ? (
                  <div className="pb-5">
                    <SnoopElement
                      type="text"
                      name={block.id}
                      label={block.data.label}
                      classNames={{
                        label:
                          "mt-4 mb-2 block text-md font-bold leading-7 text-gray-800 sm:truncate",
                        element:
                          "flex-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full min-w-0 rounded-md sm:text-base border-gray-300",
                      }}
                      required
                    />
                  </div>
                ) : block.type === "submitButton" ? (
                  <SnoopElement
                    name="submit"
                    type="submit"
                    label={block.data.label}
                    classNames={{
                      button:
                        "inline-flex items-center px-4 py-3 text-sm font-medium text-white bg-gray-700 border border-transparent rounded-md shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500",
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
