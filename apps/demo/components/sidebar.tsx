import {
  ClockIcon,
  CogIcon,
  CreditCardIcon,
  FileBarChartIcon,
  HelpCircleIcon,
  HomeIcon,
  ScaleIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import { classNames } from "../lib/utils";

const navigation = [
  { name: "Home", href: "#", icon: HomeIcon, current: true },
  { name: "History", href: "#", icon: ClockIcon, current: false },
  { name: "Balances", href: "#", icon: ScaleIcon, current: false },
  { name: "Cards", href: "#", icon: CreditCardIcon, current: false },
  { name: "Recipients", href: "#", icon: UsersIcon, current: false },
  { name: "Reports", href: "#", icon: FileBarChartIcon, current: false },
];
const secondaryNavigation = [
  { name: "Settings", href: "#", icon: CogIcon },
  { name: "Help", href: "#", icon: HelpCircleIcon },
  { name: "Privacy", href: "#", icon: ShieldCheckIcon },
];

export function Sidebar(): React.JSX.Element {
  return (
    <div className="flex flex-grow flex-col overflow-y-auto bg-cyan-700 pb-4 pt-5">
      <nav
        className="mt-5 flex flex-1 flex-col divide-y divide-cyan-800 overflow-y-auto"
        aria-label="Sidebar">
        <div className="space-y-1 px-2">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className={classNames(
                item.current ? "bg-cyan-800 text-white" : "text-cyan-100 hover:bg-cyan-600 hover:text-white",
                "group flex items-center rounded-md px-2 py-2 text-sm font-medium leading-6"
              )}
              aria-current={item.current ? "page" : undefined}>
              <item.icon className="mr-4 h-6 w-6 flex-shrink-0 text-cyan-200" aria-hidden="true" />
              {item.name}
            </a>
          ))}
        </div>
        <div className="mt-6 pt-6">
          <div className="space-y-1 px-2">
            {secondaryNavigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="group flex items-center rounded-md px-2 py-2 text-sm font-medium leading-6 text-cyan-100 hover:bg-cyan-600 hover:text-white">
                <item.icon className="mr-4 h-6 w-6 text-cyan-200" aria-hidden="true" />
                {item.name}
              </a>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
