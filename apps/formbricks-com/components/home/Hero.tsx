import Button from "../shared/Button";
import HeroAnimation from "./HeroAnimation";

interface Props {}

export default function Hero({}: Props) {
  return (
    <div className="relative px-4 pt-16 pb-20 text-center sm:px-6 lg:px-8 lg:pt-24 lg:pb-28">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl md:text-5xl">
        <span className="block xl:inline">The </span>{" "}
        <span className="block bg-gradient-to-b from-teal-400 to-teal-500 bg-clip-text text-transparent xl:inline">
          Open Source
        </span>{" "}
        <span className="block xl:inline">Forms & Survey Toolbox</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-base text-slate-500 dark:text-slate-300 sm:text-lg md:mt-5 md:max-w-3xl md:text-xl">
        We built all essential form functionality so you don't have to. Modular, customizable, extendable. And
        open-source.
      </p>
      <div className="mx-auto mt-5 max-w-md sm:flex sm:justify-center md:mt-8">
        <Button variant="secondary">See examples</Button>
        <Button variant="primary" className="ml-3">
          Get started
        </Button>
      </div>
      <HeroAnimation className="mt-20" />
    </div>
  );
}
