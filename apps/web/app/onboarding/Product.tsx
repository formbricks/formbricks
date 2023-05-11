"use client";

import Headline from "@/components/preview/Headline";
import Subheader from "@/components/preview/Subheader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProductMutation } from "@/lib/products/mutateProducts";
import { useProduct } from "@/lib/products/products";
import { Button, ColorPicker, ErrorComponent, Input, Label } from "@formbricks/ui";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

type Product = {
  done: () => void;
  environmentId: string;
  isLoading: boolean;
};

const Product: React.FC<Product> = ({ done, isLoading, environmentId }) => {
  const [loading, setLoading] = useState(true);
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { triggerProductMutate } = useProductMutation(environmentId);

  const [name, setName] = useState("");
  const [color, setColor] = useState("#334155");

  const handleNameChange = (event) => {
    setName(event.target.value);
  };

  const handleColorChange = (color) => {
    setColor(color);
  };

  useEffect(() => {
    if (isLoadingProduct) {
      return;
    } else if (product && product.name !== "My Product") {
      done(); // when product already exists, skip product step entirely
    } else {
      if (product) {
        setColor(product.brandColor);
      }
      setLoading(false);
    }
  }, [product, done, isLoadingProduct]);

  const dummyChoices = ["❤️ Love it!"];

  const handleDoneClick = async () => {
    if (!name || !environmentId) {
      return;
    }

    try {
      await triggerProductMutate({ name, brandColor: color });
    } catch (e) {
      toast.error("An error occured saving your settings");
      console.error(e);
    }
    done();
  };

  if (isLoadingProduct || loading) {
    return <LoadingSpinner />;
  }

  if (isErrorProduct) {
    return <ErrorComponent />;
  }

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
              <Input
                id="product"
                type="text"
                placeholder="e.g. Formbricks"
                value={name}
                onChange={handleNameChange}
              />
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
              <Headline headline={`How do you like ${name ? name : "Formbricks"}?`} questionId="none" />
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
          variant="darkCTA"
          loading={isLoading}
          disabled={!name || !environmentId}
          onClick={handleDoneClick}>
          {isLoading ? "Getting ready..." : "Done"}
        </Button>
      </div>
    </div>
  );
};

export default Product;
