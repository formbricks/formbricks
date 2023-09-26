import Logo from "@/images/formtribe/formtribe-logo.png";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@formbricks/ui";
import { Bars3Icon } from "@heroicons/react/24/solid";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const navigation = [
  { name: "How it works", href: "#how" },
  { name: "Prizes", href: "#prizes" },
  { name: "Leaderboard", href: "#leaderboard" },
  { name: "FAQ", href: "#faq" },
];

export default function HeaderLight() {
  const [mobileNavMenuOpen, setMobileNavMenuOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full items-center justify-between py-6 sm:px-2 ">
      <div className="flex items-center justify-start">
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

      {/* Desktop Menu */}
      <div className="hidden items-center gap-x-8 text-slate-700 md:flex">
        {navigation.map((navItem) => (
          <Link key={navItem.name} href={navItem.href} className="hover:scale-105">
            {navItem.name}
          </Link>
        ))}
        <Button
          variant="highlight"
          className="font-kablammo ml-2 bg-gradient-to-br from-[#032E1E] via-[#032E1E] to-[#013C27] text-xl"
          href="#join">
          Join
        </Button>
      </div>

      {/* Mobile Menu */}
      <div className="flex items-center md:hidden">
        <Popover open={mobileNavMenuOpen} onOpenChange={setMobileNavMenuOpen}>
          <PopoverTrigger onClick={() => setMobileNavMenuOpen(!mobileNavMenuOpen)}>
            <span>
              <Bars3Icon className="h-8 w-8 rounded-md bg-slate-200 p-1 text-slate-600" />
            </span>
          </PopoverTrigger>
          <PopoverContent className="mr-4 bg-slate-100 shadow">
            <div className="flex flex-col">
              {navigation.map((navItem) => (
                <Link key={navItem.name} href={navItem.href}>
                  <div
                    onClick={() => setMobileNavMenuOpen(false)}
                    className="flex items-center space-x-2 rounded-md p-2">
                    <span className="font-medium text-slate-600">{navItem.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
