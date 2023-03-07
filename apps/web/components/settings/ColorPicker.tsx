/* import { persistForm, useForm } from "@/lib/forms"; */
import { useRouter } from "next/router";
import React, { useCallback, useRef, useState } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import useClickOutside from "@/lib/useClickOutside";

export const PopoverPicker = ({ color, onChange }) => {
  const popover = useRef(null);
  const [isOpen, toggle] = useState(false);

  const close = useCallback(() => toggle(false), []);
  useClickOutside(popover, close);

  return (
    <div className="picker">
      <div
        className="relative h-6 w-10 rounded"
        style={{ backgroundColor: color }}
        onClick={() => toggle(true)}
      />

      {isOpen && (
        <div className="absolute left-16 z-20 mt-1" ref={popover}>
          <HexColorPicker color={color} onChange={onChange} />
        </div>
      )}
    </div>
  );
};

export const ColorPicker = ({ attribute }) => {
  /*   const router = useRouter();
  const { formId, organisationId } = router.query;
  const { form, isLoadingForm, isErrorForm, mutateForm } = useForm(
    formId?.toString(),
    organisationId?.toString()
  );

  const setSurveyAttribute = (attribute: string, value: any) => {
    const updatedForm = JSON.parse(JSON.stringify(form));
    if (!updatedForm.schemaDraft?.config) {
      updatedForm.schemaDraft.config = {};
    }
    updatedForm.schemaDraft.config[attribute] = value;
    mutateForm(updatedForm, false);
    persistForm(updatedForm);
    console.log(updatedForm);
  }; */

  const [color, setColor] = useState("#123123");

  const handleColorChange = (newColor) => {
    setColor(newColor);
    /* setSurveyAttribute(attribute, newColor); */
  };

  return (
    <div className="my-2">
      <div className="flex w-fit items-center space-x-1 rounded border px-2 text-slate-400">
        #
        <HexColorInput
          className="mr-2 ml-2 h-10 w-16 text-slate-500 outline-none focus:border-none"
          color={color}
          onChange={handleColorChange}
        />
        <PopoverPicker color={color} onChange={handleColorChange} />
      </div>
    </div>
  );
};
