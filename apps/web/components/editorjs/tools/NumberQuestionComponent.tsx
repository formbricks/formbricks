import { useState } from "react";
import type { NumberQuestionData } from "./NumberQuestion";

const DEFAULT_INITIAL_DATA = (): NumberQuestionData => {
  return {
    label: "",
    placeholder: "",
    help: "",
    required: false,
  };
};

type Props = {
  data: NumberQuestionData;
  onDataChange: (newData: NumberQuestionData) => void;
};

const NumberQuestionComponent = (props: Props) => {
  const [data, setData] = useState(props.data ? props.data : DEFAULT_INITIAL_DATA);

  const updateData = (newData: NumberQuestionData) => {
    setData(newData);

    if (props.onDataChange) {
      props.onDataChange(newData);
    }
  };

  const onInputChange = (fieldName: string) => {
    return (e: React.FormEvent<HTMLInputElement>) => {
      const newData = {
        ...data,
      };

      newData[fieldName] = e.currentTarget.value;

      updateData(newData);
    };
  };

  return (
    <div className="pb-5">
      <div className="text-md relative font-bold leading-7 text-gray-800 sm:truncate">
        <input
          type="text"
          id="label"
          defaultValue={data.label}
          className="w-full border-0 border-transparent p-0 ring-0 placeholder:text-gray-300 focus:ring-0"
          placeholder="Your Question"
          onChange={onInputChange("label")}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-red-500">
          *
        </div>
      </div>
      <input
        type="text"
        className="mt-1 block w-full max-w-sm rounded-md border-gray-300 text-sm text-gray-400 shadow-sm placeholder:text-gray-300"
        placeholder="optional placeholder"
        defaultValue={data.placeholder}
        onChange={onInputChange("placeholder")}
      />
      <input
        type="text"
        id="help-text"
        defaultValue={data.help}
        className="mt-2 block w-full max-w-sm border-0 border-transparent p-0 text-sm font-light text-gray-500 ring-0 placeholder:text-gray-300 focus:ring-0"
        placeholder="optional help text"
        onChange={onInputChange("help")}
      />
    </div>
  );
};

export default NumberQuestionComponent;
