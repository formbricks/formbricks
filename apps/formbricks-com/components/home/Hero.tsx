import TemplateList from "../dummyUI/TemplateList";

interface Props {}

export default function Hero({}: Props) {
  return (
    <div className="relative">
      <div className="px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
          <span className="xl:inline">Better experience data.</span>{" "}
          <span className="from-brand-light to-brand-dark bg-gradient-to-b bg-clip-text text-transparent xl:inline">
            Better business
          </span>
          <span className="inline ">.</span>
        </h1>

        <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-500 dark:text-slate-300 sm:text-lg md:mt-5 md:text-xl">
          Survey specific customer segments at any point in the user journey.
          <br />
          <span className="hidden md:block">
            Continuously measure what your customers think and feel. All open-source.
          </span>
        </p>
        {/* 
        <div className="mx-auto mt-5 max-w-md sm:flex sm:justify-center md:mt-8">
          <Button variant="secondary" className="" onClick={() => router.push("#best-practices")}>
            Best practices
          </Button>
          <Button variant="highlight" className="ml-3 px-6" onClick={() => router.push("/waitlist")}>
            Get Access
          </Button>
        </div> */}
      </div>

      <TemplateList />
    </div>
  );
}
