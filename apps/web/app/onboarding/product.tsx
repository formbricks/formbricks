"use client";

import { Button, ColorPicker, Input, Label } from "@/../../packages/ui";
import Headline from "@/components/preview/Headline";
import Subheader from "@/components/preview/Subheader";
import { useProductMutation } from "@/lib/products/mutateProducts";
import { useState } from "react";

type Product = {
  done: () => void;
  environmentId: string;
};

const Product: React.FC<Product> = ({ done, environmentId }) => {
  const { triggerProductMutate, isMutatingProduct } = useProductMutation(environmentId);

  const [name, setName] = useState("");
  const [color, setColor] = useState("#334155");

  const handleNameChange = (event) => {
    setName(event.target.value);
  };

  const handleColorChange = (color) => {
    setColor(color);
  };

  const dummyChoices = ["❤️ Love it!"];

  const handleDoneClick = async () => {
    if (!name || !environmentId) {
      return;
    }

    try {
      await triggerProductMutate({ name, brandColor: color });
    } catch (e) {
      console.log(e);
    }
    done();
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-8 px-8">
      <div className="px-4">
        <label className="mb-1.5 block text-lg font-semibold leading-6 text-slate-900">
          Create your team&apos;s product.
        </label>
        <Subheader subheader="You can always change these settings later." questionId="none" />
        <div className="mt-6 flex flex-col gap-2">
          <div className="pb-2">
            <div className="flex justify-between">
              <Label htmlFor="product">Your product name</Label>
              <span className="text-xs text-slate-500">Required</span>
            </div>
            <div className="mt-2">
              <Input id="product" type="text" placeholder="e.g. Formbricks" onChange={handleNameChange} />
            </div>
          </div>
          <div>
            <Label htmlFor="color">Primary color</Label>
            <div className="mt-2">
              <ColorPicker color={color} onChange={handleColorChange} />
            </div>
          </div>
          <div className="relative flex cursor-not-allowed flex-col items-center gap-4 rounded-md border border-slate-300 px-16 py-8">
            <div
              className="absolute left-0 right-0 top-0 h-full w-full opacity-10"
              style={{ backgroundColor: color }}
            />
            <p className="text-xs text-slate-500">This is what your survey will look like:</p>
            <div className="relative w-full max-w-sm cursor-not-allowed rounded-lg bg-white px-4 py-6 shadow-lg ring-1 ring-black ring-opacity-5 sm:p-6">
              <Headline headline={`How do you like ${name ? name : "PRODUCT"}?`} questionId="none" />
              <div className="mt-4">
                <fieldset>
                  <legend className="sr-only">Choices</legend>
                  <div className=" relative space-y-2 rounded-md">
                    {dummyChoices.map((choice) => (
                      <label
                        key={choice}
                        className="relative z-10 flex flex-col rounded-md border border-slate-400 bg-slate-50 p-4 hover:bg-slate-50 focus:outline-none">
                        <span className="flex items-center text-sm">
                          <input
                            checked
                            readOnly
                            type="radio"
                            className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                            style={{ borderColor: "brandColor", color: "brandColor" }}
                          />
                          <span className="ml-3 font-medium">{choice}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="mt-4 flex w-full justify-end">
                <Button className="pointer-events-none" style={{ backgroundColor: color }}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end">
        <Button
          size="lg"
          variant="primary"
          loading={isMutatingProduct}
          disabled={!name || !environmentId}
          onClick={handleDoneClick}>
          Done
        </Button>
      </div>
    </div>
  );
};

export default Product;
