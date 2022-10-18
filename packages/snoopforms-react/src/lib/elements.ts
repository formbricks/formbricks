import { Option } from '../types';

export const setSubmissionValue = (
  v: any,
  pageName: string,
  name: string,
  setSubmission: (s: any) => void
) => {
  setSubmission((submission: any) => {
    const newSubmission = { ...submission };
    if (!(pageName in newSubmission)) {
      newSubmission[pageName] = {};
    }
    newSubmission[pageName][name] = v;
    return newSubmission;
  });
};

export const getOptionsSchema = (options: any[] | undefined) => {
  const newOptions = [];
  if (options) {
    for (const option of options) {
      if (typeof option === 'string') {
        newOptions.push({ label: option, value: option });
      }
      if (
        typeof option === 'object' &&
        'value' in option &&
        'label' in option
      ) {
        newOptions.push({ label: option.label, value: option.value });
      }
    }
  }
  return newOptions;
};

export function getOptionValue(option: string | Option) {
  return typeof option === 'object' ? option.value : option;
}
