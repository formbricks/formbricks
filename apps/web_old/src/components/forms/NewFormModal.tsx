"use client";

import { createForm } from "@/lib/forms";
import { Button } from "@formbricks/ui";
import { Dialog, RadioGroup, Transition } from "@headlessui/react";
import { PMFIcon, FeedbackIcon, UserCommentIcon } from "@formbricks/ui";
import { XMarkIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { BsPlus } from "react-icons/bs";
import Link from "next/link";
import LoadingSpinner from "../LoadingSpinner";
import { useOrganisation } from "@/lib/organisations";
import UpgradeModal from "../UpgradeModal";

type FormOnboardingModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  organisationId: string;
};

export default function NewFormModal({ open, setOpen, organisationId }: FormOnboardingModalProps) {
  const router = useRouter();
  const [openUpgradeModal, setOpenUpgradeModal] = useState(false);
  const [label, setLabel] = useState("");
  const [formType, setFormType] = useState("feedback");
  const { organisation, isLoadingOrganisation, isErrorOrganisation } = useOrganisation(organisationId);

  const formTypes = useMemo(
    () => [
      {
        id: "feedback",
        name: "Feedback Box",
        description: "A direct channel to feel the pulse of your users.",
        icon: FeedbackIcon,
      },
      {
        id: "custom",
        name: "Custom Survey",
        description: "Create and analyze your custom survey.",
        icon: UserCommentIcon,
      },
      {
        id: "pmf",
        name: "Product-Market Fit Survey",
        description: "Leverage the Superhuman PMF engine.",
        icon: PMFIcon,
        needsUpgrade: process.env.NEXT_PUBLIC_IS_FORMBRICKS_CLOUD === "1" && organisation?.plan === "free",
      },
    ],
    [organisation]
  );

  if (isLoadingOrganisation) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorOrganisation) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }

  const createFormAction = async (e) => {
    e.preventDefault();
    let formTemplate;
    if (formType === "feedback") {
      formTemplate = {
        label,
        type: "feedback",
        schema: {
          schemaVersion: 1,
          config: {},
          pages: [
            {
              id: "feedbackTypePage",
              elements: [
                {
                  type: "radio",
                  name: "feedbackType",
                  label: "What's on your mind?",
                  options: [
                    { label: "Idea", value: "idea" },
                    { label: "Compliment", value: "compliment" },
                    { label: "Bug", value: "bug" },
                  ],
                },
              ],
            },
            {
              id: "messagePage",
              elements: [
                {
                  type: "textarea",
                  name: "message",
                  label: "What's your feedback?",
                },
              ],
            },
            {
              id: "thankYouPage",
              endScreen: true,
              elements: [
                {
                  type: "html",
                  name: "thankYou",
                },
              ],
            },
          ],
        },
      };
    } else if (formType === "custom") {
      formTemplate = {
        label,
        type: "custom",
      };
    } else if (formType === "pmf") {
      formTemplate = {
        label,
        type: "pmf",
        schema: {
          schemaVersion: 1,
          config: {},
          pages: [
            {
              id: "disappointmentPage",
              config: {
                autoSubmit: true,
              },
              elements: [
                {
                  id: "disappointment",
                  type: "radio",
                  name: "disappointment",
                  label: "How disappointed would you be if you could no longer use our service?",
                  options: [
                    { label: "Very disappointed", value: "veryDisappointed" },
                    { label: "Somewhat disappointed", value: "somewhatDisappointed" },
                    { label: "Not disappointed", value: "notDisappointed" },
                  ],
                },
              ],
            },
            {
              id: "mainBenefitPage",
              elements: [
                {
                  id: "mainBenefit",
                  type: "text",
                  name: "mainBenefit",
                  label: "What is the main benefit you receive from our service?",
                },
              ],
            },
            {
              id: "rolePage",
              config: {
                autoSubmit: true,
              },
              elements: [
                {
                  id: "role",
                  type: "radio",
                  name: "role",
                  label: "What is your role?",
                  options: [
                    { label: "Founder", value: "founder" },
                    { label: "Executive", value: "executive" },
                    { label: "Product Manager", value: "productManager" },
                    { label: "Product Owner", value: "productOwner" },
                    { label: "Software Engineer", value: "softwareEngineer" },
                  ],
                },
              ],
            },
            {
              id: "improvementPage",
              elements: [
                {
                  id: "improvement",
                  type: "text",
                  name: "improvement",
                  label: "How can we improve our service for you?",
                },
              ],
            },
            {
              id: "benefitingUsers",
              elements: [
                {
                  id: "benefitingUsers",
                  type: "text",
                  name: "benefitingUsers",
                  label: "What type of people would benefit most from using our service?",
                },
              ],
            },
            {
              id: "thankYouPage",
              endScreen: true,
              elements: [
                {
                  id: "thankYou",
                  type: "html",
                  name: "thankYou",
                },
              ],
            },
          ],
        },
      };
    } else {
      throw new Error("Unknown form type");
    }
    const form = await createForm(organisationId, formTemplate);
    router.push(`/organisations/${organisationId}/forms/${form.id}/${form.type}/`);
  };

  return (
    <>
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={setOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0">
            <div className="fixed inset-0 bg-slate-500 bg-opacity-30 backdrop-blur-md transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
                <Dialog.Panel className="relative transform rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-white text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-0 focus:ring-offset-2"
                      onClick={() => setOpen(false)}>
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex flex-row justify-between">
                    <h2 className="flex-none p-2 text-xl font-bold text-slate-800">Create new form</h2>
                  </div>
                  <form
                    onSubmit={(e) => createFormAction(e)}
                    className="inline-block w-full transform overflow-hidden p-2 text-left align-bottom transition-all sm:align-middle">
                    <div>
                      <label htmlFor="email" className="text-sm font-light text-slate-800">
                        Name your form
                      </label>
                      <div className="mt-2">
                        <input
                          type="text"
                          name="label"
                          className="focus:border-brand focus:ring-brand block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                          placeholder="e.g. Feedback Box App"
                          value={label}
                          onChange={(e) => setLabel(e.target.value)}
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                    <hr className="my-6 text-slate-600" />
                    <RadioGroup value={formType} onChange={setFormType}>
                      <RadioGroup.Label className="text-sm font-light text-slate-800">
                        Choose your form type
                      </RadioGroup.Label>
                      <div className="mt-3 space-y-4">
                        {formTypes.map((formType) => (
                          <div
                            key={formType.name}
                            onClick={() => {
                              if (formType.needsUpgrade) {
                                setOpenUpgradeModal(true);
                              }
                            }}>
                            <RadioGroup.Option
                              disabled={formType.needsUpgrade}
                              value={formType.id}
                              className={({ checked, active, disabled }) =>
                                clsx(
                                  checked ? "border-transparent" : "border-slate-300",
                                  active ? "border-brand ring-brand ring-2" : "",
                                  disabled ? "bg-slate-100" : "bg-white",
                                  "relative block cursor-pointer rounded-lg border bg-white px-6 py-4 shadow-sm focus:outline-none sm:flex"
                                )
                              }>
                              {({ active, checked }) => (
                                <>
                                  <RadioGroup.Description
                                    as="span"
                                    className="mt-2 mr-3 flex text-sm sm:mt-0 sm:flex-col sm:text-right">
                                    <formType.icon className="h-8 w-8" />
                                  </RadioGroup.Description>
                                  <span className="flex items-center">
                                    <span className="flex flex-col text-sm">
                                      <RadioGroup.Label as="span" className="font-medium text-slate-900">
                                        {formType.name}
                                        {formType.needsUpgrade && (
                                          <Link href={`/organisations/${organisation.id}/settings/billing`}>
                                            <span className="ml-2 inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                                              Pro Feature
                                            </span>
                                          </Link>
                                        )}
                                      </RadioGroup.Label>
                                      <RadioGroup.Description as="span" className="text-slate-500">
                                        {formType.description}
                                      </RadioGroup.Description>
                                    </span>
                                  </span>

                                  <span
                                    className={clsx(
                                      active ? "border" : "border-2",
                                      checked ? "border-brand" : "border-transparent",
                                      "pointer-events-none absolute -inset-px rounded-lg"
                                    )}
                                    aria-hidden="true"
                                  />
                                </>
                              )}
                            </RadioGroup.Option>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>

                    <div className="mt-5 sm:mt-6">
                      <Button type="submit" className="w-full justify-center">
                        create form
                        <BsPlus className="ml-1 h-6 w-6"></BsPlus>
                      </Button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
      <UpgradeModal open={openUpgradeModal} setOpen={setOpenUpgradeModal} organisationId={organisationId} />
    </>
  );
}
