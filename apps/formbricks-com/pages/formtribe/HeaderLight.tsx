import Logo from "@/images/formtribe/formtribe-logo.png";
import { Button } from "@formbricks/ui";
import { Popover } from "@headlessui/react";
import Image from "next/image";
import Link from "next/link";

export default function HeaderLight() {
  return (
    <Popover className="relative" as="header">
      <div className="mx-auto flex items-center justify-between py-6 sm:px-2 md:justify-start  lg:px-8 xl:px-12 ">
        <div className="flex w-0 flex-1 items-center justify-start">
          <Link href="/">
            <span className="sr-only">FormTribe</span>
            <Image alt="Formtribe Logo" src={Logo} className="ml-7 h-8 w-auto sm:h-10" />
          </Link>

          <Link
            href="https://formbricks.com/github"
            target="_blank"
            className="ml-6 mt-1 text-sm text-slate-500 hover:scale-105">
            Star us ⭐
          </Link>
        </div>

        <div className="hidden flex-1 items-center justify-end gap-x-8 text-slate-700 md:flex">
          <Link href="#how" className="hover:scale-105">
            How it works
          </Link>
          <Link href="#prizes" className="hover:scale-105">
            Prizes
          </Link>
          <Link href="#leaderboard" className="hover:scale-105">
            Leaderboard
          </Link>
          <Link href="#faq" className="hover:scale-105">
            FAQ
          </Link>
          <Button
            variant="highlight"
            className="font-kablammo ml-2 bg-gradient-to-br from-[#032E1E] via-[#032E1E] to-[#013C27] text-xl"
            href="#join">
            Join
          </Button>
        </div>
      </div>
    </Popover>
  );
}
