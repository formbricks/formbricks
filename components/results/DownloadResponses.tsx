import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { CircularProgress } from "@mui/material";
import { parseAsync } from "json2csv";
import { Fragment, useState } from "react";
import { toast } from "react-toastify";
import { useForm } from "../../lib/forms";
import { useNoCodeForm } from "../../lib/noCodeForm";
import {
  getSubmission,
  useSubmissionSessions,
} from "../../lib/submissionSessions";
import { Submission } from "../../lib/types";
import {
  formatPages,
  getFormPages,
  reformatBlocks,
  slugify,
} from "../../lib/utils";
import Loading from "../Loading";

export default function DownloadResponses({ formId, candidates }) {
  const { noCodeForm, isLoadingNoCodeForm } = useNoCodeForm(formId);
  const pages = getFormPages(noCodeForm.blocks, formId);
  const [isDataExporting, setIsDataExporting] = useState(false);
  const pagesFormated = formatPages(pages);

  const getUserSubmissions = async (candidateId) => {
    try {
      const res = await fetch(
        `/api/forms/${formId}/events/${candidateId}/user-submissions`,
        {
          method: "GET",
        }
      );
      return res.json();
    } catch (error) {
      toast(error);
    }
  };

  /**
   * Pour chaque candidat formater ses différentes soumissions
   * Avoir une colonne id, noms, whatsapp, genre, phone, chaque étape différentes soumissions
   */

  const { form, isLoadingForm } = useForm(formId);

  const download = async (format: "csv" | "excel") => {
    // build data fields for csv/excel file
    setIsDataExporting(true);
    const data = [];
    const fields: any = [
      {
        label: "Timestamp",
        value: "createdAt",
      },
      {
        label: "Nom",
        value: "lastname",
      },
      {
        label: "Prénom",
        value: "firstname",
      },
      {
        label: "Téléphone",
        value: "phone",
      },

      {
        label: "Whatsapp",
        value: "whatsapp",
      },
      {
        label: "Email",
        value: "email",
      },
      {
        label: "Genre",
        value: "gender",
      },
    ];

    await Promise.all(
      candidates.map(
        async ({ phone, gender, id, whatsapp, email, firstname, lastname }) => {
          const dataEntry = {
            phone,
            gender,
            whatsapp,
            email,
            firstname,
            lastname,
            createdAt: undefined,
          };
          const candidateSubmission = await getUserSubmissions(id);
          dataEntry["createdAt"] = candidateSubmission[0]?.createdAt;

          if (candidateSubmission.length) {
            candidateSubmission.map((event) => {
              const pageSubmissions = {};
              if (event.data["submission"]) {
                Object.keys(event.data["submission"]).map((key) => {
                  const question =
                    pagesFormated[event.data["pageName"]].blocks[key]?.data
                      .label;
                  const response = event.data["submission"][key];
                  pageSubmissions[question] = response;
                });
              }
              dataEntry[
                pagesFormated[event.data["pageName"]].title
              ] = pageSubmissions;

              const isFieldExist = data.findIndex(
                (item) => email === item.email
              );
              const isCandidateExist = data.findIndex(
                (item) => email === item.email
              );
              if (isFieldExist === -1) {
                fields.push({
                  label: pagesFormated[event.data["pageName"]].title,
                  value: pagesFormated[event.data["pageName"]].title,
                });
              }
              if (isCandidateExist !== -1) {
                data[isCandidateExist] = dataEntry;
              } else {
                data.push(dataEntry);
              }
            });
          }
        }
      )
    );

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
      setIsDataExporting(false);
    } catch (err) {
      setIsDataExporting(false);
      console.error(err);
    }
  };

  if (isLoadingForm) {
    return <Loading />;
  }

  return (
    <Menu as='div' className='relative z-10 inline-block w-full text-left'>
      <div>
        <Menu.Button className='inline-flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75'>
          {isDataExporting ? (
            <CircularProgress color='error' />
          ) : (
            <>
              Télécharger
              <ChevronDownIcon
                className='w-5 h-5 ml-2 -mr-1 text-white hover:text-gray-100'
                aria-hidden='true'
              />
            </>
          )}
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter='transition ease-out duration-100'
        enterFrom='transform opacity-0 scale-95'
        enterTo='transform opacity-100 scale-100'
        leave='transition ease-in duration-75'
        leaveFrom='transform opacity-100 scale-100'
        leaveTo='transform opacity-0 scale-95'
      >
        <Menu.Items className='absolute right-0 w-56 mt-2 origin-top-right bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'>
          <div className='px-1 py-1 '>
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
