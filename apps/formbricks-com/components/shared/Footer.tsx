import Link from "next/link";
import { FooterLogo } from "./Logo";

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
      icon: (props: any) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
        </svg>
      ),
    },
    {
      name: "GitHub",
      href: "https://github.com/formbricks/formbricks",
      icon: (props: any) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          <path
            fillRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  ],
};

export default function Footer() {
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
            &copy; 2022. All rights reserved.
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
