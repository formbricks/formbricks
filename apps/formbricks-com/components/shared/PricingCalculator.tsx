import { Slider } from "@/components/shared/Slider";
import { useState } from "react";

const ProductItem = ({ label, usersCount, price, onSliderChange }) => (
  <div className="mt-12">
    <div className="mb-2 flex items-center gap-x-2 md:gap-x-4">
      <div className="md:text-md w-3/6 text-left text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </div>
      <div className="md:text-md w-2/6 text-center text-sm font-medium text-slate-700 dark:text-slate-200">
        {Math.round(usersCount).toLocaleString()} MTU
      </div>
      <div className="md:text-md flex w-1/6 items-center justify-end text-center text-sm font-medium text-slate-700 dark:text-slate-200 md:justify-center">
        <span>${price.toFixed(2)}</span>
      </div>
    </div>
    <div className="my-2 w-5/6 pr-8 md:pr-20">
      <Slider
        className="slider-class"
        defaultValue={[Math.log10(1000)]}
        min={3}
        max={6}
        step={0.01}
        onValueChange={onSliderChange}
      />
      <div className="mt-2 flex items-center justify-between text-sm">
        {[3, 4, 5, 6].map((mark) => (
          <span key={mark} className="text-slate-600 dark:text-slate-300">
            {mark === 3 ? "1K" : mark === 4 ? "10K" : mark === 5 ? "100K" : "1M"}
          </span>
        ))}
      </div>
    </div>
  </div>
);

const Headers = () => (
  <div className="mb-4 flex justify-between">
    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 md:text-lg">Product</h3>
    <h3 className="w-1/6 text-center text-base font-semibold text-slate-700 dark:text-slate-200 md:text-lg">
      Subtotal
    </h3>
  </div>
);

const MonthlyEstimate = ({ price }) => (
  <div className="mt-2 flex justify-between">
    <span className="text-base font-semibold text-slate-700 dark:text-slate-200 md:text-lg">
      Monthly estimate:
    </span>
    <div className="w-1/6 text-center">
      <span className="w-1/6 text-base text-slate-700 dark:text-slate-200 md:text-lg md:font-semibold">
        ${price.toFixed(2)}
      </span>
      <span className="hidden text-sm text-slate-400 dark:text-slate-500 md:block md:text-base">
        {" "}
        / month
      </span>
    </div>
  </div>
);

export const PricingCalculator = () => {
  const [inProductSlider, setInProductSlider] = useState(Math.log10(1000));
  const [linkSlider, setLinkSlider] = useState(Math.log10(1000));

  const transformToLog = (value) => Math.pow(10, value);

  const calculatePrice = (users) => {
    if (users <= 5000) {
      return 0;
    } else {
      return users * 0.005;
    }
  };

  const usersCountForInProductSlider = transformToLog(inProductSlider);
  const productSurveysPrice = calculatePrice(usersCountForInProductSlider);

  return (
    <div className="px-4 md:px-16">
      <h2 className="px-4 py-4 text-lg font-semibold leading-7 tracking-tight text-slate-800 dark:text-slate-200 md:px-12 md:text-2xl">
        Pricing Calculator
      </h2>

      <div className="rounded-xl bg-slate-100 px-4 py-4 dark:bg-slate-800 md:px-12">
        <div className="rounded-xl px-4">
          <Headers />

          <hr className="my-4" />

          <ProductItem
            label="In Product Surveys"
            usersCount={usersCountForInProductSlider}
            price={productSurveysPrice}
            onSliderChange={(value) => setInProductSlider(value[0])}
          />

          <hr className="my-4" />

          <ProductItem
            label="Link Surveys"
            usersCount={transformToLog(linkSlider)}
            price={0}
            onSliderChange={(value) => setLinkSlider(value[0])}
          />

          <hr className="my-4" />

          <MonthlyEstimate price={productSurveysPrice} />
        </div>
      </div>
    </div>
  );
};
