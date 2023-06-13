import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { useState } from "react";

interface APICallProps {
  method: "GET" | "POST";
  url: string;
  description: string;
  headers: {
    label: string;
    type: string;
    description: string;
  }[];
  bodies: {
    label: string;
    type: string;
    description: string;
    required?: boolean;
  }[];
  responses: {
    color: string;
    statusCode: string;
    description: string;
    example?: string;
  }[];
  example?: string;
}

export function APILayout({ method, url, description, headers, bodies, responses, example }: APICallProps) {
  const [switchState, setSwitchState] = useState(true);
  function handleOnChange() {
    setSwitchState(!switchState);
  }

  return (
    <div className="rounded-lg bg-slate-200 p-8 dark:bg-slate-700">
      {switchState ? (
        <ChevronDownIcon
          className="hover:text-brand-dark dark:hover:text-brand-dark mr-3 inline h-5 w-5 hover:cursor-pointer"
          aria-hidden="true"
          onClick={handleOnChange}
        />
      ) : (
        <ChevronRightIcon
          className="hover:text-brand-dark dark:hover:text-brand-dark mr-3 inline h-5 w-5 hover:cursor-pointer"
          aria-hidden="true"
          onClick={handleOnChange}
        />
      )}
      <div
        className={clsx(
          "mr-3 inline rounded-full p-1 px-3 font-semibold text-white",
          method === "POST" && "bg-red-400 dark:bg-red-800",
          method === "GET" && "bg-green-400 dark:bg-green-800"
        )}>
        {method}
      </div>
      <div className="inline text-sm text-slate-500 ">
        https://app.formbricks.com
        <span className="font-bold text-black dark:text-slate-300">{url}</span>
      </div>
      <div className="ml-8 mt-4 font-bold dark:text-slate-400">{description}</div>
      <div>
        <div className={clsx(switchState ? "block" : "hidden", "ml-8")}>
          <p className="mb-2 mt-6 text-lg font-semibold">Parameters</p>
          <div>
            {headers.length > 0 && (
              <div className="text-base">
                <p className="not-prose -mb-1 pt-2 font-bold">Headers</p>
                <div>
                  {headers.map((q) => (
                    <Parameter key={q.label} label={q.label} type={q.type} description={q.description} />
                  ))}
                </div>
              </div>
            )}

            {bodies && (
              <div className="mt-4 text-base">
                <p className="not-prose -mb-1 pt-2 font-bold">Body</p>
                <div>
                  {}
                  {bodies?.map((b) => (
                    <Parameter
                      key={b.label}
                      label={b.label}
                      type={b.type}
                      description={b.description}
                      required={b.required}
                    />
                  ))}
                  {example && (
                    <div>
                      <p className="not-prose mb-2 pt-2 font-bold">Body Example</p>
                      <div>
                        <pre>
                          <code>{example}</code>
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div>
              <div className="mt-4 text-base">
                <p className="not-prose -mb-1 pt-2 font-bold">Responses</p>
                <div>
                  {responses.map((r) => (
                    <Response
                      key={r.color}
                      color={r.color}
                      statusCode={r.statusCode}
                      description={r.description}
                      example={r.example}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ParaProps {
  label: string;
  type: string;
  description: string;
  required?: boolean;
}

function Parameter({ label, type, description, required }: ParaProps) {
  return (
    <>
      <div className="my-2 grid grid-cols-4 text-sm">
        <div className="inline font-mono">
          {label}
          {required && <p className="inline font-bold text-red-500">*</p>}
        </div>
        <div>{type}</div>
        <div className="col-span-2">{description}</div>
      </div>
    </>
  );
}

interface RespProps {
  color: string;
  statusCode: string;
  description: string;
  example?: string;
}

function Response({ color, statusCode, description, example }: RespProps) {
  const [toggleExample, setSwitchState] = useState(false);
  function handleOnChange() {
    setSwitchState(!toggleExample);
  }
  return (
    <div className="my-2 grid grid-cols-2 text-sm">
      <div className="text-md inline-flex items-center font-semibold">
        <div
          className={clsx(
            "mr-3 inline h-3 w-3 rounded-full",
            color === "green" && "bg-green-400",
            color === "brown" && "bg-amber-800"
          )}>
          &nbsp;
        </div>
        <div>{statusCode}</div>
      </div>
      <div className="flex items-center justify-between">
        <div>{description}</div>
        <div className="font-bold">
          {example &&
            (toggleExample ? (
              <ChevronDownIcon
                className={clsx(
                  toggleExample ? "block" : "hidden",
                  "hover:text-brand-dark dark:hover:text-brand-dark mr-3 inline h-6 w-6 hover:cursor-pointer"
                )}
                aria-hidden="true"
                onClick={handleOnChange}
              />
            ) : (
              <ChevronLeftIcon
                className={clsx(
                  toggleExample ? "hidden" : "block",
                  "hover:text-brand-dark dark:hover:text-brand-dark mr-3 inline h-6 w-6 hover:cursor-pointer"
                )}
                aria-hidden="true"
                onClick={handleOnChange}
              />
            ))}
        </div>
      </div>
      {example && toggleExample && (
        <div className="col-span-2 my-3 whitespace-pre-wrap rounded-lg bg-slate-300 p-2 font-mono dark:bg-slate-600 dark:text-slate-300">
          {example}
        </div>
      )}
    </div>
  );
}
