import { GlobeAltIcon, MailIcon, PhoneIcon } from "@heroicons/react/solid";
import { SnoopElement, SnoopForm, SnoopPage } from "@snoopforms/react";
import { useMemo } from "react";
import { trackPosthogEvent } from "../../lib/posthog";
import { generateId } from "../../lib/utils";
import Loading from "../Loading";

export default function App({ id = "", formId, blocks, localOnly = false }) {
  const pages = useMemo(() => {
    const pages = [];
    let currentPage = {
      id: formId, // give the first page the formId as id by default
      blocks: [],
    };
    for (const block of blocks) {
      if (block.type !== "pageTransition") {
        currentPage.blocks.push(block);
      } else {
        currentPage.blocks.push({
          id: generateId(10),
          data: {
            label: block.data.submitLabel,
          },
          type: "submitButton",
        });
        pages.push(currentPage);
        currentPage = {
          id: block.id,
          blocks: [],
        };
      }
    }
    pages.push(currentPage);
    return pages;
  }, [blocks, formId]);

  if (!pages) return <Loading />;

  return (
    <div className="w-full px-5 py-5">
      <SnoopForm
        key={id} // used to reset form
        domain={window.location.host}
        protocol={window.location.protocol === "http:" ? "http" : "https"}
        formId={formId}
        localOnly={localOnly}
        className="w-full max-w-3xl mx-auto space-y-6"
        onSubmit={() => {
          if (!localOnly) {
            trackPosthogEvent("submitForm", { formId });
          }
        }}
      >
        {pages.map((page, pageIdx) => (
          <SnoopPage
            key={page.id}
            name={page.id}
            thankyou={pageIdx === pages.length - 1}
          >
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
                  <SnoopElement
                    type="text"
                    name={block.id}
                    label={block.data.label}
                    placeholder={block.data.placeholder}
                    classNames={{
                      label:
                        "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 sm:truncate",
                    }}
                    required={block.data.required}
                  />
                ) : block.type === "emailQuestion" ? (
                  <SnoopElement
                    type="email"
                    name={block.id}
                    label={block.data.label}
                    placeholder={block.data.placeholder}
                    icon={<MailIcon className="w-5 h-5" />}
                    classNames={{
                      label:
                        "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 sm:truncate",
                    }}
                    required={block.data.required}
                  />
                ) : block.type === "multipleChoiceQuestion" &&
                  block.data.multipleChoice ? (
                  <SnoopElement
                    type="checkbox"
                    name={block.id}
                    label={block.data.label}
                    options={block.data.options.map((o) => o.label)}
                    classNames={{
                      label:
                        "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 sm:truncate",
                    }}
                    required={block.data.required}
                  />
                ) : block.type === "multipleChoiceQuestion" &&
                  !block.data.multipleChoice ? (
                  <SnoopElement
                    type="radio"
                    name={block.id}
                    label={block.data.label}
                    options={block.data.options.map((o) => o.label)}
                    classNames={{
                      label:
                        "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 sm:truncate",
                    }}
                    required={block.data.required}
                  />
                ) : block.type === "numberQuestion" ? (
                  <SnoopElement
                    type="number"
                    name={block.id}
                    label={block.data.label}
                    placeholder={block.data.placeholder}
                    classNames={{
                      label:
                        "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 sm:truncate",
                    }}
                    required={block.data.required}
                  />
                ) : block.type === "phoneQuestion" ? (
                  <SnoopElement
                    type="phone"
                    name={block.id}
                    label={block.data.label}
                    placeholder={block.data.placeholder}
                    icon={<PhoneIcon className="w-5 h-5" />}
                    classNames={{
                      label:
                        "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 sm:truncate",
                    }}
                    required={block.data.required}
                  />
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
                ) : block.type === "websiteQuestion" ? (
                  <SnoopElement
                    type="website"
                    name={block.id}
                    label={block.data.label}
                    placeholder={block.data.placeholder}
                    icon={<GlobeAltIcon className="w-5 h-5" />}
                    classNames={{
                      label:
                        "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 sm:truncate",
                    }}
                    required={block.data.required}
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
