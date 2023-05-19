import { FC, useState } from "react";
import {
  GlobeAltIcon,
  EnvelopeIcon,
  PhoneIcon,
} from "@heroicons/react/24/solid";
import { useRouter } from "next/router";
import Image from "next/image";
import {
  SnoopElement,
  SnoopForm,
  SnoopPage,
} from "../../kda-snoopforms-react/src";
import { Page, PageBlock, pageSubmissionEvent } from "../../lib/types";
import { findTimer, isTimedPage } from "../../lib/utils";

interface IProps {
  id: string;
  formId: string;
  page?: Page;
  submission?: pageSubmissionEvent;
  localOnly: boolean;
  startDate: Date;
}

const App: FC<IProps> = ({
  id = "",
  formId,
  page,
  submission,
  localOnly = false,
  startDate = new Date(),
}) => {
  const [fieldErrors, setFieldErrors] = useState({});
  const router = useRouter();

  const onSubmit = () => {
    if (!Object.values(fieldErrors).filter((f) => f).length)
      router.push(`/sourcings/${formId}`);
  };
  //TODO Find better way to handle this
  if (findTimer(page, startDate) < 0 && isTimedPage(page)) {
    return (
      <div className='flex min-h-screen bg-ui-gray-light'>
        <div className='flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24'>
          <div className='w-full max-w-sm p-8 mx-auto lg:w-96'>
            <div className='w-fit m-auto'>
              <Image
                src='/img/kadea_logo.png'
                alt='Kadea  academy logo'
                width={180}
                height={40}
              />
            </div>
            <div className='mt-8'>
              <h1 className='mb-4 font-bold text-center leading-2'>
                Temps écoulé
              </h1>
              <p className='text-center'>
                Vous n'avez plus accès à ce formulaire car votre temps est écoulé
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='w-full px-5 py-5'>
      <SnoopForm
        key={id} // used to reset form
        domain={window.location.host}
        protocol={window.location.protocol === "http:" ? "http" : "https"}
        formId={formId}
        localOnly={localOnly}
        className='w-full max-w-3xl mx-auto space-y-6'
        onSubmit={onSubmit}
        setFieldErrors={setFieldErrors}
        page={page}
      >
        <SnoopPage
          name={page.id}
          thankyou={false}
          time={findTimer(page, startDate)}
          countDown={isTimedPage(page)}
        >
          {page.blocks.map((block: PageBlock) => (
            <div key={block.id}>
              {block.type === "paragraph" ? (
                <p
                  className='ce-paragraph'
                  dangerouslySetInnerHTML={{
                    __html: block.data.text as string,
                  }}
                ></p>
              ) : block.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={block.data.file.url} alt={block.data.caption} />
              ) : block.type === "header" ? (
                block.data.level === 1 ? (
                  <h1
                    dangerouslySetInnerHTML={{
                      __html: block.data.text as string,
                    }}
                    className='ce-header'
                  />
                ) : block.level === 2 ? (
                  <h2
                    className='ce-header'
                    dangerouslySetInnerHTML={{
                      __html: block.data.text as string,
                    }}
                  />
                ) : block.data.level === 3 ? (
                  <h3
                    className='ce-header'
                    dangerouslySetInnerHTML={{
                      __html: block.data.text as string,
                    }}
                  />
                ) : null
              ) : block.type === "textQuestion" ? (
                <SnoopElement
                  type='text'
                  name={block.id}
                  label={block.data.label}
                  help={block.data.help}
                  placeholder={block.data.placeholder}
                  defaultValue={submission?.data?.submission[block.id]}
                  classNames={{
                    label:
                      "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 ",
                  }}
                  required={block.data.required}
                  error={fieldErrors[block.id]}
                />
              ) : block.type === "textareaQuestion" ? (
                <SnoopElement
                  type="textarea"
                  name={block.id}
                  label={block.data.label}
                  help={block.data.help}
                  placeholder={block.data.placeholder}
                  defaultValue={submission?.data?.submission[block.id]}
                  classNames={{
                    label:
                      "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 ",
                  }}
                  required={block.data.required}
                  error={fieldErrors[block.id]}
                />
              ) : block.type === "emailQuestion" ? (
                <SnoopElement
                  type='email'
                  name={block.id}
                  label={block.data.label}
                  defaultValue={
                    !isTimedPage(page)
                      ? submission.data?.submission[block.id]
                      : ""
                  }
                  help={block.data.help}
                  placeholder={block.data.placeholder}
                  icon={<EnvelopeIcon className='w-5 h-5' />}
                  classNames={{
                    label:
                      "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 ",
                  }}
                  required={block.data.required}
                  error={fieldErrors[block.id]}
                />
              ) : block.type === "multipleChoiceQuestion" &&
                block.data.multipleChoice ? (
                <SnoopElement
                  type='checkbox'
                  defaultValue={
                    !isTimedPage(page)
                      ? submission.data?.submission[block.id]
                      : ""
                  }
                  name={block.id}
                  label={block.data.label}
                  help={block.data.help}
                  options={block.data.options.map((o) => o.label)}
                  classNames={{
                    label:
                      "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 ",
                  }}
                  required={block.data.required}
                  error={fieldErrors[block.id]}
                />
              ) : block.type === "multipleChoiceQuestion" &&
                !block.data.multipleChoice ? (
                <SnoopElement
                  type='radio'
                  name={block.id}
                  defaultValue={
                    !isTimedPage(page)
                      ? submission.data?.submission[block.id]
                      : ""
                  }
                  label={block.data.label}
                  help={block.data.help}
                  options={block.data.options}
                  classNames={{
                    label:
                      "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 ",
                  }}
                  required={block.data.required}
                  error={fieldErrors[block.id]}
                />
              ) : block.type === "numberQuestion" ? (
                <SnoopElement
                  type='number'
                  name={block.id}
                  label={block.data.label}
                  defaultValue={
                    !isTimedPage(page)
                      ? submission.data?.submission[block.id]
                      : ""
                  }
                  help={block.data.help}
                  placeholder={block.data.placeholder}
                  classNames={{
                    label:
                      "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 ",
                  }}
                  required={block.data.required}
                  error={fieldErrors[block.id]}
                />
              ) : block.type === "phoneQuestion" ? (
                <SnoopElement
                  type='phone'
                  name={block.id}
                  label={block.data.label}
                  help={block.data.help}
                  placeholder={block.data.placeholder}
                  defaultValue={
                    !isTimedPage(page)
                      ? submission.data?.submission[block.id]
                      : ""
                  }
                  icon={<PhoneIcon className='w-5 h-5' />}
                  classNames={{
                    label:
                      "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 ",
                  }}
                  required={block.data.required}
                  error={fieldErrors[block.id]}
                />
              ) : block.type === "submitButton" ? (
                <SnoopElement
                  name='submit'
                  type='submit'
                  label={block.data.label}
                  classNames={{
                    button:
                      "inline-flex items-center px-4 py-3 text-sm font-medium text-white bg-gray-700 border border-transparent rounded-md shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500",
                  }}
                />
              ) : block.type === "websiteQuestion" ? (
                <SnoopElement
                  type='website'
                  name={block.id}
                  label={block.data.label}
                  help={block.data.help}
                  defaultValue={
                    !isTimedPage(page)
                      ? submission.data?.submission[block.id]
                      : ""
                  }
                  placeholder={block.data.placeholder}
                  icon={<GlobeAltIcon className='w-5 h-5' />}
                  classNames={{
                    label:
                      "mt-4 mb-2 block text-lg font-bold leading-7 text-gray-800 ",
                  }}
                  required={block.data.required}
                  error={fieldErrors[block.id]}
                />
              ) : block.type === "dashboardRedirectButton" ? (
                <SnoopElement
                  type='button-link'
                  link={`/sourcings/${formId}`}
                  name={block.id}
                  label={block.data.submitLabel}
                  classNames={{
                    button:
                      "inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-white border border-transparent rounded-md shadow-sm bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500",
                  }}
                />
              ) : null}
            </div>
          ))}
        </SnoopPage>
      </SnoopForm>
    </div>
  );
};

export default App;
