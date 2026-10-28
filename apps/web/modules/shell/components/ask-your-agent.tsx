import { getTranslate } from "@/lingodotdev/server";
import { CodeBlock } from "@/modules/ui/components/code-block";

interface AskYourAgentProps {
  /** What to say to the agent, ready to paste. */
  prompt: string;
  /** One line on what the prompt does; the heading is always "Ask your agent". */
  description?: string;
}

/**
 * Where an action button used to be: a prompt to copy into the connected agent. The shell is read-only
 * for everything an agent can do, so the person is pointed at the agent instead of a form.
 */
export const AskYourAgent = async ({ prompt, description }: Readonly<AskYourAgentProps>) => {
  const t = await getTranslate();

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800">{t("shell.ask_agent.title")}</h3>
      <p className="text-sm text-slate-600">{description ?? t("shell.ask_agent.hint")}</p>
      <div className="rounded-lg border border-slate-200 bg-white px-3 pt-2.5 pb-3.5">
        <CodeBlock noMargin language="none" customEditorClass="pr-8">
          {prompt}
        </CodeBlock>
      </div>
    </section>
  );
};
