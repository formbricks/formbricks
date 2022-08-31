import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { parseAsync } from "json2csv";
import { Fragment } from "react";
import { useForm } from "../../lib/forms";
import {
  getSubmission,
  useSubmissionSessions,
} from "../../lib/submissionSessions";
import { Submission } from "../../lib/types";
import { slugify } from "../../lib/utils";
import Loading from "../Loading";

export default function DownloadResponses({ formId }) {
  const { submissionSessions, isLoadingSubmissionSessions } =
    useSubmissionSessions(formId);
  const { form, isLoadingForm } = useForm(formId);

  const download = async (format: "csv" | "excel") => {
    // build dict of answers in copy of answerSessions
    const submissions: Submission[] = submissionSessions.map((s) =>
      getSubmission(s, form.schema)
    );
    // build data fields for csv/excel file
    const data = [];
    for (const submission of submissions) {
      const dataEntry = { createdAt: submission.createdAt };
      for (const page of submission.pages) {
        if (page.elements) {
          for (const element of page.elements) {
            if (element.type !== "submit") {
              dataEntry[element.label] = element.value;
            }
          }
        }
      }
      data.push(dataEntry);
    }

    // get fields
    const fields: any = [
      {
        label: "Timestamp",
        value: "createdAt",
      },
    ];

    for (const page of submissions[0].pages) {
      for (const element of page.elements) {
        if (element.type !== "submit") {
          fields.push({
            label: element.label,
            value: element.label,
          });
        }
      }
    }
    const opts: any = { fields };

    if (format === "excel") {
      opts.excelStrings = true;
    }
    const fileTypes = {
      csv: { mimeType: "text/csv", fileExtension: "csv" },
      excel: { mimeType: "application/vnd.ms-excel", fileExtension: "csv" },
    };

    try {
      const csv = await parseAsync(data, opts);
      // download
      var blob = new Blob([csv], { type: fileTypes[format].mimeType });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${slugify(form.name)}.${fileTypes[format].fileExtension}`
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoadingSubmissionSessions || isLoadingForm) {
    return <Loading />;
  }

  return (
    <Menu as="div" className="relative z-10 inline-block w-full text-left">
      <div>
        <Menu.Button className="inline-flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75">
          Download
          <ChevronDownIcon
            className="w-5 h-5 ml-2 -mr-1 text-white hover:text-gray-100"
            aria-hidden="true"
          />
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 w-56 mt-2 origin-top-right bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="px-1 py-1 ">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => download("csv")}
                  className={`${
                    active ? "bg-red-500 text-white" : "text-gray-900"
                  } group flex rounded-md items-center w-full px-2 py-2 text-sm`}
                >
                  Download as CSV
                </button>
              )}
            </Menu.Item>
            {/*  <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => download("excel")}
                  className={`${
                    active ? "bg-red-500 text-white" : "text-gray-900"
                  } group flex rounded-md items-center w-full px-2 py-2 text-sm`}
                >
                  Download as Excel
                </button>
              )}
            </Menu.Item> */}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
