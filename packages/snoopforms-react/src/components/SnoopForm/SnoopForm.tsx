import React, { createContext, FC, ReactNode, useState } from 'react';
import { classNamesConcat } from '../../lib/utils';

export const SchemaContext = createContext({
  schema: { pages: [] },
  setSchema: (schema: any) => {
    console.log(schema);
  },
});

export const SubmissionContext = createContext({
  submission: {},
  setSubmission: (submission: any) => {
    console.log(submission);
  },
});

export const CurrentPageContext = createContext({
  currentPageIdx: 0,
  setCurrentPageIdx: (currentPageIdx: number) => {
    console.log(currentPageIdx);
  },
});

export const SubmitHandlerContext = createContext((pageName: string) => {
  console.log(pageName);
});

interface onSubmitProps {
  submission: any;
  schema: any;
}

interface Props {
  domain?: string;
  formId?: string;
  protocol?: 'http' | 'https';
  localOnly?: boolean;
  className?: string;
  onSubmit?: (obj: onSubmitProps) => void;
  children?: ReactNode;
}

export const SnoopForm: FC<Props> = ({
  domain = 'app.snoopforms.com',
  formId,
  protocol = 'https',
  localOnly = false,
  className = '',
  onSubmit = (): any => {},
  children,
}) => {
  const [schema, setSchema] = useState<any>({ pages: [] });
  const [submission, setSubmission] = useState<any>({});
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [submissionSessionId, setSubmissionSessionId] = useState('');

  const handleSubmit = async (pageName: string) => {
    let _submissionSessionId = submissionSessionId;
    if (!localOnly) {
      // create answer session if it don't exist
      try {
        if (!formId) {
          console.warn(
            `🦝 SnoopForms: formId not set. Skipping sending submission to snoopHub.`
          );
          return;
        }
        if (!_submissionSessionId) {
          // create new submissionSession in snoopHub

          const submissionSessionRes: any = await fetch(
            `${protocol}://${domain}/api/forms/${formId}/submissionSessions`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            }
          );
          const submissionSession = await submissionSessionRes.json();
          _submissionSessionId = submissionSession.id;
          setSubmissionSessionId(_submissionSessionId);
        }
        // send answer to snoop platform
        await fetch(`${protocol}://${domain}/api/forms/${formId}/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events: [
              {
                type: 'pageSubmission',
                data: {
                  pageName,
                  submissionSessionId: _submissionSessionId,
                  submission: submission[pageName],
                },
              },
              // update schema
              // TODO: do conditionally only when requested by the snoopHub
              { type: 'updateSchema', data: schema },
            ],
          }),
        });
      } catch (e) {
        console.error(
          `🦝 SnoopForms: Unable to send submission to snoopHub. Error: ${e}`
        );
      }
    }
    const maxPageIdx = schema.pages.length - 1;
    const hasThankYou = schema.pages[maxPageIdx].type === 'thankyou';
    if (currentPageIdx < maxPageIdx) {
      setCurrentPageIdx(currentPageIdx + 1);
    }
    if (
      (!hasThankYou && currentPageIdx === maxPageIdx) ||
      (hasThankYou && currentPageIdx === maxPageIdx - 1)
    ) {
      return onSubmit({ submission, schema });
    }
  };

  return (
    <SubmitHandlerContext.Provider value={handleSubmit}>
      <SchemaContext.Provider value={{ schema, setSchema }}>
        <SubmissionContext.Provider value={{ submission, setSubmission }}>
          <CurrentPageContext.Provider
            value={{ currentPageIdx, setCurrentPageIdx }}
          >
            <div className={classNamesConcat('max-w-lg', className)}>
              {children}
            </div>
          </CurrentPageContext.Provider>
        </SubmissionContext.Provider>
      </SchemaContext.Provider>
    </SubmitHandlerContext.Provider>
  );
};
