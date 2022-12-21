import { Transition } from "@headlessui/react";
import { ChevronDownIcon, XMarkIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import Link from "next/link";
import { Fragment, useState } from "react";
import { BugIconGray } from "./BugIconGray";
import { ComplimentIconGray } from "./ComplimentIconGray";
import { IdeaIconGray } from "./IdeaIconGray";

const navigation = [
  { id: "idea", name: "I have an idea", icon: IdeaIconGray },
  { id: "compliment", name: "I like something", icon: ComplimentIconGray },
  { id: "bug", name: "Something’s broken", icon: BugIconGray },
];

interface FeedbackModalProps {
  show: boolean;
  setShow: (show: boolean) => void;
  formId: string;
  customer?: any;
}

export default function FeedbackModal({ show, setShow, formId, customer }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<any>();
  const [feedbackSent, setFeedbackSent] = useState(false);
  return (
    <>
      {/* Global notification live region, render this permanently at the end of the document */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-end sm:p-6">
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          {/* Notification panel, dynamically insert this into the live region when it needs to be displayed */}
          <Transition
            show={show}
            as={Fragment}
            enter="transform ease-out duration-300 transition"
            enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
            enterTo="translate-y-0 opacity-100 sm:translate-x-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0">
            <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
              {/* Header */}
              <div className="relative bg-slate-900 p-4 ">
                <div className="absolute right-4 top-4 ml-4 flex flex-shrink-0">
                  <button
                    type="button"
                    className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
                    onClick={() => {
                      setShow(false);
                      setTimeout(() => {
                        setFeedbackType(undefined);
                        setFeedbackSent(false);
                      }, 200);
                    }}>
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex items-start">
                  <div className="w-full text-center text-lg text-white">We &hearts; your feedback</div>
                </div>
              </div>

              {typeof feedbackType === "undefined" ? (
                <div className="p-4">
                  <div className="w-full text-center text-xs text-gray-700">What&apos;s on your mind?</div>
                  <nav className="mt-3 space-y-1" aria-label="Sidebar">
                    {navigation.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => {
                          setFeedbackType(item);
                        }}
                        className="group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">
                        <item.icon
                          className={clsx(
                            "text-gray-400 group-hover:text-gray-500",
                            "-ml-1 mr-3 h-7 w-7 flex-shrink-0"
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.name}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              ) : feedbackSent === false ? (
                <>
                  <button
                    key={feedbackType.name}
                    onClick={() => setFeedbackType(undefined)}
                    className="group flex w-full items-center justify-center bg-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
                    <feedbackType.icon
                      className="-ml-1 mr-3 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
                      aria-hidden="true"
                    />
                    <span className="truncate">{feedbackType.name}</span>
                    <ChevronDownIcon className="h-6 w-6 text-gray-500" />
                  </button>

                  <div className="p-4">
                    <div className="group block flex-shrink-0">
                      <div className="flex items-center">
                        <div>
                          <img
                            className="inline-block h-9 w-9 rounded-full"
                            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                            alt=""
                          />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                            Thanks for sharing this!
                          </p>
                          <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700">
                            Tom Cook, CEO
                          </p>
                        </div>
                      </div>
                    </div>
                    <form
                      onSubmit={(e: any) => {
                        const body = {
                          data: {
                            feedbackType: feedbackType.id,
                            message: e.target.message.value,
                            pageUrl: window.location.href,
                          },
                        };
                        if (customer) {
                          body["customer"] = customer;
                        }
                        e.preventDefault();
                        fetch(`http://localhost:3000/api/capture/forms/${formId}/submissions`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify(body),
                        });
                        console.log("submission sent!");
                        e.target.reset();
                        setFeedbackSent(true);
                      }}>
                      <textarea
                        rows={5}
                        name="message"
                        id="message"
                        className="mt-5 block w-full rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
                        placeholder={
                          feedbackType.id === "idea"
                            ? "I would love to..."
                            : feedbackType.id === "compliment"
                            ? "I want to say Thank you for..."
                            : "I tried to do this but it is not working because..."
                        }
                      />
                      <div className="mt-2 flex w-full justify-end">
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-md border border-transparent bg-slate-800 px-3 py-2 text-sm font-medium leading-4 text-white shadow-sm hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2">
                          Send
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div className="p-4">
                  <div className="w-full text-center font-medium text-gray-600">
                    {feedbackType.id === "bug"
                      ? "Feedback received."
                      : feedbackType.id === "compliment"
                      ? "Thanks for sharing!"
                      : "Brainstorming in progress..."}
                  </div>
                  <div className="mt-2 w-full text-center text-sm text-gray-500">
                    {feedbackType.id === "bug"
                      ? "We are doing our best to fix this asap. Thank you!"
                      : feedbackType.id === "compliment"
                      ? "We're working hard on this. Your warm words make it fun!"
                      : "We'll look into it and get back to you. Thank you!"}
                  </div>
                  <div className="group mt-6 block flex-shrink-0">
                    <div className="flex items-center justify-center">
                      <div>
                        <img
                          className="inline-block h-9 w-9 rounded-full"
                          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                          alt=""
                        />
                      </div>
                      <div className="ml-3">
                        <p className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                          Tom Cook
                        </p>
                        <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700">CEO</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 mb-2">
                    <div className="text-center text-xs text-gray-600">More to share?</div>
                    <div className="text-center text-xs font-bold text-gray-600">
                      <Link href="https://slack.com" target="_blank">
                        Join Slack
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Transition>
        </div>
      </div>
    </>
  );
}
