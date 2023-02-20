import { useEffect, useState } from "react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";

import { RadioGroup } from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/24/solid";
import { useSessionEventUsers } from "../../lib/events";
// import { SubmissionSession } from "../../lib/types";
// import SubmissionDisplay from "./SubmissionDisplay";
import DownloadResponses from "./DownloadResponses";
import Loading from "../Loading";
import { toast } from "react-toastify";
import { NoCodeForm, SessionEvent } from "@prisma/client";
import usePages from "../../hooks/usePages";
import { candidateDataGridSchemaColumn } from "../usersDataGridSchemaColumn";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

type ResultsResponseProps = {
  formId: string;
  noCodeForm: NoCodeForm;
};

export default function ResultsResponses({
  formId,
  noCodeForm,
}: ResultsResponseProps) {
  const { candidates, isLoadingEvents } = useSessionEventUsers(formId);
  const [
    isLoadingCandidateSubmission,
    setIsLoadingCandidateSubmission,
  ] = useState(true);

  const [activeCandidate, setActiveCandidate] = useState<SessionEvent | null>(
    null
  );
  const [userSubmissions, setUserSubmissions] = useState<SessionEvent[]>([]);

  const formPages = formatPages(
    usePages({ blocks: noCodeForm.blocks, formId })
  );

  function reformatBlocks(blocks) {
    let tempBlocks = {};
    blocks.forEach((block) => {
      tempBlocks[block.id] = { type: block.type, data: block.data };
    });
    return tempBlocks;
  }

  function formatPages(pages: any[]) {
    let tempPages = {};
    pages.forEach((page) => {
      tempPages[page.id] = {
        title: page.blocks[0].data.text,
        blocks: reformatBlocks(page.blocks),
      };
    });
    return tempPages;
  }

  const getUserSubmissions = async () => {
    try {
      const res = await fetch(
        `/api/forms/${formId}/events/${activeCandidate.id}/user-submissions`,
        {
          method: "GET",
        }
      );
      return res.json();
    } catch (error) {
      toast(error);
    }
  };

  useEffect(() => {
    if (!isLoadingEvents && candidates.length > 0) {
      setActiveCandidate(candidates[0]);
      setUserSubmissions([]);
    }
  }, [isLoadingEvents, noCodeForm, candidates]);

  useEffect(() => {
    getUserSubmissions().then((subs) => {
      setUserSubmissions(subs);
      setIsLoadingCandidateSubmission(false);
    });
  }, [activeCandidate]);

  if (isLoadingEvents) {
    return <Loading />;
  }

  return (
    <div className='flex flex-col flex-1 w-full h-full mx-auto overflow-visible max-w-screen'>
      <div className='relative z-0 flex flex-1 h-full overflow-visible'>
        <main className='relative z-0 flex-1 mb-32 overflow-y-auto focus:outline-none xl:order-last'>
          <div className='overflow-visible sm:rounded-lg'>
            {!activeCandidate ? (
              <button
                type='button'
                className='relative block p-12 mx-auto mt-8 text-center border-2 border-gray-300 border-dashed rounded-lg w-96 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              >
                <span className='block mt-2 text-sm font-medium text-gray-500'>
                  Choisis un candidat à gauche pour voir sa soumission ici
                </span>
              </button>
            ) : (
              <div className='py-5 bg-white shadow'>
                <div className='grid gap-8 divide-x'>
                  <div className='hidden pl-10 md:flow-root'>
                    <h1 className='mb-8 text-gray-700'>
                      Soumissions du candidat
                    </h1>
                    <ul role='list' className='-mb-8'>
                      {isLoadingCandidateSubmission ? (
                        <Loading />
                      ) : (
                        userSubmissions?.map((event) => (
                          <li key={event.id}>
                            <div className='relative pb-8'>
                              <span
                                className='absolute top-4 left-4 -ml-px h-full w-0.5 bg-ui-gray-light'
                                aria-hidden='true'
                              />
                              <div className='relative flex space-x-3'>
                                <span
                                  className={classNames(
                                    "bg-red-200",
                                    "h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white"
                                  )}
                                >
                                  <CheckIcon
                                    className='w-5 h-5 text-white'
                                    aria-hidden='true'
                                  />
                                </span>
                                <div className='min-w-0 flex-1 pt-1.5 flex justify-between flex-wrap gap-4'>
                                  <div>
                                    <h3>
                                      {formPages[event.data["pageName"]].title}
                                    </h3>
                                    <ul className='text-sm text-gray-500'>
                                      {event.data["submission"] &&
                                        Object.keys(
                                          event.data["submission"]
                                        ).map((key) => {
                                          const question =
                                            formPages[event.data["pageName"]]
                                              .blocks[key]?.data.label;
                                          return (
                                            <li key={key}>
                                              <hr />
                                              <p className='py-3'>
                                                <b>{`${question}`}</b>
                                                &nbsp;
                                                <span>{`=> ${event.data["submission"][key]}`}</span>
                                              </p>
                                            </li>
                                          );
                                        })}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                    {!userSubmissions.length && (
                      <div className='relative block p-12 mx-auto mt-8 text-center border-2 border-gray-300 border-dashed rounded-lg w-96 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'>
                        <span className='block mt-2 text-sm font-medium text-gray-500'>
                          Aucune reponse jusque là
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
        <aside className='flex flex-col flex-1 flex-shrink-0 order-first h-full border-r border-ui-gray-light md:flex-none md:w-1/3'>
          <DownloadResponses formId={formId} candidates={candidates} />
          <div className='pt-4 pb-2'>
            <h2 className='px-5 text-lg font-medium text-gray-900'>Réponses</h2>
          </div>
          {candidates.length === 0 ? (
            <p className='px-5 mt-3 text-sm text-gray-500'>
              Aucun candidat n&apos;a répondu jusque là
            </p>
          ) : (
            <RadioGroup
              value={activeCandidate}
              onChange={setActiveCandidate}
              className='flex- min-h-0 mb-32 overflow-y-auto shadow-inner'
              as='div'
            >
              <div className='relative'>
                <div style={{ width: "100%" }}>
                  <DataGrid
                    columns={candidateDataGridSchemaColumn}
                    rows={candidates.map(
                      ({ id, firstname, lastname, gender, email }) => ({
                        id,
                        Noms: `${firstname} ${lastname}`,
                        Genre: gender,
                        Email: email,
                      })
                    )}
                    components={{ Toolbar: GridToolbar }}
                    autoHeight
                    onCellClick={({ row }) => {
                      setActiveCandidate(row);
                      setIsLoadingCandidateSubmission(true);
                    }}
                  />
                </div>
              </div>
            </RadioGroup>
          )}
        </aside>
      </div>
    </div>
  );
}
