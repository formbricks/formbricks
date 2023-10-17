import Link from "next/link";
import { FooterLogo } from "./Logo";
import { FaGithub, FaXTwitter, FaDiscord } from "react-icons/fa6";

const navigation = {
  other: [
    { name: "Community", href: "/community", status: true },
    { name: "Blog", href: "/blog", status: true },
    { name: "OSS Friends", href: "/oss-friends", status: true },
    { name: "GDPR FAQ", href: "/gdpr", status: true },
    { name: "GDPR Guide", href: "/gdpr-guide", status: true },
  ],
  social: [
    {
      name: "Twitter",
      href: "https://twitter.com/formbricks",
      icon: FaXTwitter,
    },
    {
      name: "GitHub",
      href: "https://github.com/formbricks/formbricks",
      icon: FaGithub,
    },
    {
      name: "Discord",
      href: "https://formbricks.com/discord",
      icon: FaDiscord,
    },
  ],
};
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="mt-32 bg-gradient-to-b from-slate-50 to-slate-200 dark:from-slate-900 dark:to-slate-800"
      aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto flex max-w-7xl flex-col space-y-6 px-4 py-12 text-center sm:px-6 lg:px-8 lg:py-16">
        <Link href="/">
          <span className="sr-only">Formbricks</span>
          <FooterLogo className="mx-auto h-8 w-auto sm:h-10" />
        </Link>
        <p className="text-base text-slate-500 dark:text-slate-400">Privacy-first Experience Management</p>
        <div className="border-slate-500">
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Formbricks GmbH &copy; {currentYear}. All rights reserved.
            <br />
            <Link href="/imprint">Imprint</Link> | <Link href="/privacy">Privacy Policy</Link> |{" "}
            <Link href="/terms">Terms</Link> | <Link href="/oss-friends">OSS Friends</Link>
          </p>
        </div>
        <div className="flex justify-center space-x-6">
          {navigation.social.map((item) => (
            <Link key={item.name} href={item.href} className="text-slate-400 hover:text-slate-500">
              <span className="sr-only">{item.name}</span>
              <item.icon className="h-6 w-6" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
