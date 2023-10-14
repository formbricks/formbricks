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
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
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
    {
      name: "Discord",
      href: "https://discord.com/invite/3YFcABF2Ts",
      icon: (props: any) => (
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="h-5 w-5 fill-slate-700 transition group-hover:fill-slate-900 dark:group-hover:fill-slate-500"
          {...props}>
          <path d="M16.238 4.515a14.842 14.842 0 0 0-3.664-1.136.055.055 0 0 0-.059.027 10.35 10.35 0 0 0-.456.938 13.702 13.702 0 0 0-4.115 0 9.479 9.479 0 0 0-.464-.938.058.058 0 0 0-.058-.027c-1.266.218-2.497.6-3.664 1.136a.052.052 0 0 0-.024.02C1.4 8.023.76 11.424 1.074 14.782a.062.062 0 0 0 .024.042 14.923 14.923 0 0 0 4.494 2.272.058.058 0 0 0 .064-.02c.346-.473.654-.972.92-1.496a.057.057 0 0 0-.032-.08 9.83 9.83 0 0 1-1.404-.669.058.058 0 0 1-.029-.046.058.058 0 0 1 .023-.05c.094-.07.189-.144.279-.218a.056.056 0 0 1 .058-.008c2.946 1.345 6.135 1.345 9.046 0a.056.056 0 0 1 .059.007c.09.074.184.149.28.22a.058.058 0 0 1 .023.049.059.059 0 0 1-.028.046 9.224 9.224 0 0 1-1.405.669.058.058 0 0 0-.033.033.056.056 0 0 0 .002.047c.27.523.58 1.022.92 1.495a.056.056 0 0 0 .062.021 14.878 14.878 0 0 0 4.502-2.272.055.055 0 0 0 .016-.018.056.056 0 0 0 .008-.023c.375-3.883-.63-7.256-2.662-10.246a.046.046 0 0 0-.023-.021Zm-9.223 8.221c-.887 0-1.618-.814-1.618-1.814s.717-1.814 1.618-1.814c.908 0 1.632.821 1.618 1.814 0 1-.717 1.814-1.618 1.814Zm5.981 0c-.887 0-1.618-.814-1.618-1.814s.717-1.814 1.618-1.814c.908 0 1.632.821 1.618 1.814 0 1-.71 1.814-1.618 1.814Z"></path>
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
            Formbricks GmbH &copy; 2022. All rights reserved.
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
