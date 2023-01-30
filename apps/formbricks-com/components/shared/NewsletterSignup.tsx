import Image from "next/image";
import { Button } from "@formbricks/ui";
import Friends from "@/images/newsletter-signup-gif.gif";

export default function WaitlistForm() {
  return (
    <div className="not-prose text-md mx-auto mt-12 max-w-7xl rounded-lg bg-slate-200 p-10 text-slate-500 shadow-lg dark:bg-slate-800 dark:text-slate-400">
      <p className="my-0 text-2xl font-bold text-slate-600 dark:text-slate-300">Build in public</p>
      Get all the juicy details of our journey building Formbricks in public 👇
      <div className="mt-8 gap-4 md:grid md:grid-cols-2">
        <form method="post" action="https://listmonk.formbricks.com/subscription/form">
          <div className="p-6 ">
            <div>
              <input type="hidden" name="nonce" />
            </div>
            <div>
              <input
                type="email"
                name="email"
                required
                placeholder="Email"
                className="block w-full rounded-xl text-slate-900 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
              />
              <label htmlFor="email" className="ml-2 block text-sm text-slate-400 dark:text-slate-500">
                Work or personal
              </label>
            </div>
            <div>
              <input
                type="text"
                name="name"
                placeholder="Name"
                required
                className="mt-4 block w-full rounded-xl text-slate-900 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
              />
              <label htmlFor="name" className="ml-2 block text-sm text-slate-400 dark:text-slate-500">
                Optional but appreciated
              </label>
            </div>
            <div className="hidden">
              <input
                id="e0084"
                type="checkbox"
                name="l"
                checked
                value="e0084486-8751-43e4-8cfb-58b7c3f5f318"
                readOnly
              />
              <label htmlFor="e0084">Build in public</label>
            </div>
            <Button type="submit" className="mt-5 w-full justify-center">
              Subscribe
            </Button>
          </div>
        </form>

        <Image src={Friends} alt="Sign up to newsletter" className="not-prose rounded-xl" />
      </div>
    </div>
  );
}
