import { Button } from "@/components/Button";
import logoHtml from "@/images/frameworks/html5.svg";
import logoNextjs from "@/images/frameworks/nextjs.svg";
import logoReactJs from "@/images/frameworks/reactjs.svg";
import logoVueJs from "@/images/frameworks/vuejs.svg";
import Image from "next/image";

const libraries = [
  {
    href: "#html",
    name: "HTML",
    description: "All you need to do is add 3 lines of code to your HTML script and thats it, you're done!",
    logo: logoHtml,
  },
  {
    href: "#react-js",
    name: "React.js",
    description: "Load the our Js library with your environment ID and you're ready to go!",
    logo: logoReactJs,
  },
  {
    href: "#next-js",
    name: "Next.js",
    description:
      "Natively add us to your NextJs project with support for both App as well as Pages project structure!",
    logo: logoNextjs,
  },
  {
    href: "#vue-js",
    name: "Vue.js",
    description: "Simply add us to your router change and sit back!",
    logo: logoVueJs,
  },
];

export const Libraries = () => {
  return (
    <div className="my-16 xl:max-w-none">
      <div className="not-prose mt-4 grid grid-cols-1 gap-x-6 gap-y-10 border-slate-900/5 sm:grid-cols-2 xl:max-w-none xl:grid-cols-3 dark:border-white/5">
        {libraries.map((library) => (
          <a
            key={library.name}
            href={library.href}
            className="flex flex-row-reverse gap-6 rounded-2xl p-6 transition-all duration-100 ease-in-out hover:cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
            <div className="flex-auto">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{library.name}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{library.description}</p>
              <p className="mt-4">
                <Button href={library.href} variant="text" arrow="right">
                  Read more
                </Button>
              </p>
            </div>
            <Image src={library.logo} alt="" className="h-12 w-12" unoptimized />
          </a>
        ))}
      </div>
    </div>
  );
};
