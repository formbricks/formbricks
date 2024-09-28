import { InfoIcon } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { Alert, AlertDescription, AlertTitle } from "../../Alert";
import { FormControl, FormError, FormField, FormItem } from "../../Form";
import { Label } from "../../Label";
import { TabToggle } from "../../TabToggle";
import { CssSelector } from "./components/CssSelector";
import { InnerHtmlSelector } from "./components/InnerHtmlSelector";
import { PageUrlSelector } from "./components/PageUrlSelector";

interface NoCodeActionFormProps {
  form: UseFormReturn<TActionClassInput>;
}

export const NoCodeActionForm = ({ form }: NoCodeActionFormProps) => {
  const { control, watch } = form;

  return (
    <>
      <FormField
        name={`noCodeConfig.type`}
        control={control}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <div>
                <Label className="font-semibold">What is the user doing?</Label>
                <TabToggle
                  id="userAction"
                  {...field}
                  defaultSelected={field.value}
                  options={[
                    { value: "click", label: "Click" },
                    { value: "pageView", label: "Page View" },
                    { value: "exitIntent", label: "Exit Intent" },
                    { value: "fiftyPercentScroll", label: "50% Scroll" },
                  ]}
                />
              </div>
            </FormControl>
          </FormItem>
        )}
      />

      <div className="mt-2">
        {watch("noCodeConfig.type") === "click" && (
          <FormField
            control={control}
            name="noCodeConfig.elementSelector"
            render={() => (
              <FormItem>
                <FormControl>
                  <>
                    <CssSelector form={form} />
                    <InnerHtmlSelector form={form} />
                  </>
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />
        )}
        {watch("noCodeConfig.type") === "pageView" && (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Page View</AlertTitle>
            <AlertDescription>This action will be triggered when the page is loaded.</AlertDescription>
          </Alert>
        )}
        {watch("noCodeConfig.type") === "exitIntent" && (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Exit Intent</AlertTitle>
            <AlertDescription>
              This action will be triggered when the user tries to leave the page.
            </AlertDescription>
          </Alert>
        )}
        {watch("noCodeConfig.type") === "fiftyPercentScroll" && (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>50% Scroll</AlertTitle>
            <AlertDescription>
              This action will be triggered when the user scrolls 50% of the page.
            </AlertDescription>
          </Alert>
        )}
        <PageUrlSelector form={form} />
      </div>
    </>
  );
};
