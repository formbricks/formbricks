import { Terminal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../Alert";
import { FormControl, FormField, FormItem, FormLabel } from "../../Form";
import { Input } from "../../Input";

interface CodeActionFormProps {
  form: any;
  isEdit: boolean;
}

export const CodeActionForm = ({ form, isEdit }: CodeActionFormProps) => {
  const { control, watch } = form;

  return (
    <>
      <div className="col-span-1">
        <FormField
          control={control}
          name="key"
          render={({ field, fieldState: { error } }) => (
            <FormItem>
              <FormLabel htmlFor="codeActionKeyInput">Key</FormLabel>

              <FormControl>
                <Input
                  id="codeActionKeyInput"
                  placeholder="e.g. download_cta_click_on_home"
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
        <AlertTitle>How do Code Actions work?</AlertTitle>
        <AlertDescription>
          You can track code action anywhere in your app using{" "}
          <span className="rounded bg-slate-100 px-2 py-1 text-xs">
            formbricks.track(&quot;{watch("key")}&quot;)
          </span>{" "}
          in your code. Read more in our{" "}
          <a href="https://formbricks.com/docs/actions/code" target="_blank" className="underline">
            docs
          </a>
          .
        </AlertDescription>
      </Alert>
    </>
  );
};
