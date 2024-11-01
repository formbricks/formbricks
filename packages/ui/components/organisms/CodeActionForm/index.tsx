import { Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "../../Alert";
import { FormControl, FormField, FormItem, FormLabel } from "../../Form";
import { Input } from "../../Input";

interface CodeActionFormProps {
  form: any;
  isEdit: boolean;
}

export const CodeActionForm = ({ form, isEdit }: CodeActionFormProps) => {
  const { control, watch } = form;
  const t = useTranslations();
  return (
    <>
      <div className="col-span-1">
        <FormField
          control={control}
          name="key"
          render={({ field, fieldState: { error } }) => (
            <FormItem>
              <FormLabel htmlFor="codeActionKeyInput">{t("common.key")}</FormLabel>

              <FormControl>
                <Input
                  id="codeActionKeyInput"
                  placeholder={t("environments.actions.eg_download_cta_click_on_home")}
                  {...field}
                  className="mb-2 w-1/2"
                  value={field.value ?? ""}
                  isInvalid={!!error?.message}
                  readOnly={isEdit}
                  disabled={isEdit}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>{t("environments.actions.how_do_code_actions_work")}</AlertTitle>
        <AlertDescription>
          {t("environments.actions.you_can_track_code_action_anywhere_in_your_app_using")}
          <span className="rounded bg-slate-100 px-2 py-1 text-xs">
            formbricks.track(&quot;{watch("key")}&quot;)
          </span>{" "}
          {t("environments.actions.in_your_code_read_more_in_our")}{" "}
          <a href="https://formbricks.com/docs/actions/code" target="_blank" className="underline">
            {t("common.docs")}
          </a>
          .
        </AlertDescription>
      </Alert>
    </>
  );
};
