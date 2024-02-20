import { MatchType } from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/lib/testURLmatch";
import React, { useState } from "react";

import { TSurvey } from "@formbricks/types/surveys";
import { TSurveyInlineTriggers } from "@formbricks/types/surveys";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Input } from "@formbricks/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";

const updateInlineTriggers = (
  localSurvey: TSurvey,
  update: (inlineTriggers: TSurveyInlineTriggers | undefined) => Partial<TSurveyInlineTriggers>
): TSurvey => {
  return {
    ...localSurvey,
    inlineTriggers: {
      ...localSurvey.inlineTriggers,
      ...update(localSurvey.inlineTriggers),
    },
  };
};

const CodeActionSelector = ({
  localSurvey,
  setLocalSurvey,
}: {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
}) => {
  const [isCodeAction, setIsCodeAction] = useState(!!localSurvey.inlineTriggers?.codeConfig?.identifier);
  const codeActionIdentifier = localSurvey.inlineTriggers?.codeConfig?.identifier || "";

  const onChange = (val: string) => {
    const updatedSurvey = updateInlineTriggers(localSurvey, (triggers) => ({
      ...triggers,
      codeConfig: {
        identifier: val,
      },
    }));

    setLocalSurvey(updatedSurvey);
  };

  const onCodeActionToggle = (checked: boolean) => {
    setIsCodeAction(!isCodeAction);
    // reset the code action state if the user toggles off
    if (!checked) {
      const updatedSurvey = updateInlineTriggers(localSurvey, (triggers) => ({
        ...triggers,
        codeConfig: undefined,
      }));

      setLocalSurvey(updatedSurvey);
    }
  };

  return (
    <div>
      <AdvancedOptionToggle
        title="Code Action"
        description="Trigger this survey on a Code Action"
        isChecked={isCodeAction}
        onToggle={onCodeActionToggle}
        htmlId="codeAction">
        <div className="w-full rounded-lg border border-slate-100 p-4">
          <Input
            type="text"
            value={codeActionIdentifier || ""}
            onChange={(e) => onChange(e.target.value)}
            className="bg-white"
            placeholder="Identifier e.g. clicked-download"
          />
        </div>
      </AdvancedOptionToggle>
    </div>
  );
};

const CssSelector = ({
  setLocalSurvey,
  localSurvey,
}: {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
}) => {
  const [isCssSelector, setIsCssSelector] = useState(
    !!localSurvey.inlineTriggers?.noCodeConfig?.cssSelector?.value
  );
  const cssSelectorValue = localSurvey.inlineTriggers?.noCodeConfig?.cssSelector?.value || "";

  const onChange = (val: string) => {
    const updatedSurvey = updateInlineTriggers(localSurvey, (triggers) => ({
      ...triggers,
      noCodeConfig: {
        ...triggers?.noCodeConfig,
        cssSelector: {
          value: val,
        },
      },
    }));

    setLocalSurvey(updatedSurvey);
  };

  const onCssSelectorToggle = (checked: boolean) => {
    setIsCssSelector(!isCssSelector);
    // reset the css selector state if the user toggles off
    if (!checked) {
      const updatedSurvey = updateInlineTriggers(localSurvey, (triggers) => ({
        ...triggers,
        noCodeConfig: {
          ...triggers?.noCodeConfig,
          cssSelector: undefined,
        },
      }));

      setLocalSurvey(updatedSurvey);
    }
  };

  return (
    <div>
      <AdvancedOptionToggle
        htmlId="CssSelector"
        isChecked={isCssSelector}
        onToggle={onCssSelectorToggle}
        customContainerClass="p-0"
        title="CSS Selector"
        description="If a user clicks a button with a specific CSS class or id"
        childBorder={true}>
        <div className="w-full rounded-lg">
          <Input
            type="text"
            value={cssSelectorValue}
            onChange={(e) => onChange(e.target.value)}
            className="bg-white"
            placeholder="Add .css-class or #css-id"
          />
        </div>
      </AdvancedOptionToggle>
    </div>
  );
};

const PageUrlSelector = ({
  localSurvey,
  setLocalSurvey,
}: {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
}) => {
  const [isPageUrl, setIsPageUrl] = useState(!!localSurvey.inlineTriggers?.noCodeConfig?.pageUrl?.value);
  const matchValue = localSurvey.inlineTriggers?.noCodeConfig?.pageUrl?.rule || "exactMatch";
  const pageUrlValue = localSurvey.inlineTriggers?.noCodeConfig?.pageUrl?.value || "";

  const updatePageUrlState = (match: MatchType, pageUrl: string): TSurvey =>
    updateInlineTriggers(localSurvey, (triggers) => ({
      ...triggers,
      noCodeConfig: {
        ...triggers?.noCodeConfig,
        pageUrl: {
          rule: match,
          value: pageUrl,
        },
      },
    }));

  const onMatchChange = (match: MatchType) => {
    const updatedSurvey = updatePageUrlState(match, pageUrlValue);
    setLocalSurvey(updatedSurvey);
  };

  const onPageUrlChange = (pageUrl: string) => {
    const updatedSurvey = updatePageUrlState(matchValue, pageUrl);
    setLocalSurvey(updatedSurvey);
  };

  const onPageUrlToggle = (checked: boolean) => {
    setIsPageUrl(!isPageUrl);
    // reset the page url state if the user toggles off
    if (!checked) {
      const updatedSurvey = updateInlineTriggers(localSurvey, (triggers) => ({
        ...triggers,
        noCodeConfig: {
          ...triggers?.noCodeConfig,
          pageUrl: undefined,
        },
      }));

      setLocalSurvey(updatedSurvey);
    }
  };

  return (
    <div>
      <AdvancedOptionToggle
        htmlId="PageURL"
        isChecked={isPageUrl}
        onToggle={onPageUrlToggle}
        title="Page URL"
        customContainerClass="p-0"
        description="If a user visits a specific URL"
        childBorder={false}>
        <div className="flex w-full gap-2">
          <div className="">
            <Select onValueChange={onMatchChange}>
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue placeholder="Select match type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="exactMatch">Exactly matches</SelectItem>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="startsWith">Starts with</SelectItem>
                <SelectItem value="endsWith">Ends with</SelectItem>
                <SelectItem value="notMatch">Does not exactly match</SelectItem>
                <SelectItem value="notContains">Does not contain</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full">
            <Input
              type="text"
              value={pageUrlValue}
              onChange={(e) => onPageUrlChange(e.target.value)}
              className="bg-white"
              placeholder="e.g. https://app.com/dashboard"
            />
          </div>
        </div>
      </AdvancedOptionToggle>
    </div>
  );
};

const InnerHtmlSelector = ({
  localSurvey,
  setLocalSurvey,
}: {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
}) => {
  const [isInnerHtml, setIsInnerHtml] = useState(
    !!localSurvey.inlineTriggers?.noCodeConfig?.innerHtml?.value
  );

  const innerHtmlValue = localSurvey.inlineTriggers?.noCodeConfig?.innerHtml?.value || "";
  const onChange = (val: string) => {
    const updatedSurvey = updateInlineTriggers(localSurvey, (triggers) => ({
      ...triggers,
      noCodeConfig: {
        ...triggers?.noCodeConfig,
        innerHtml: {
          value: val,
        },
      },
    }));

    setLocalSurvey(updatedSurvey);
  };

  const onInnerHtmlToggle = (checked: boolean) => {
    setIsInnerHtml(!isInnerHtml);
    // reset the inner html state if the user toggles off
    if (!checked) {
      const updatedSurvey = updateInlineTriggers(localSurvey, (triggers) => ({
        ...triggers,
        noCodeConfig: {
          ...triggers?.noCodeConfig,
          innerHtml: undefined,
        },
      }));

      setLocalSurvey(updatedSurvey);
    }
  };

  return (
    <div>
      <AdvancedOptionToggle
        htmlId="InnerText"
        isChecked={isInnerHtml}
        onToggle={onInnerHtmlToggle}
        customContainerClass="p-0"
        title="Inner Text"
        description="If a user clicks a button with a specific text"
        childBorder={true}>
        <div className="w-full">
          <div className="grid grid-cols-3 gap-x-8">
            <div className="col-span-3 flex items-end">
              <Input
                type="text"
                value={innerHtmlValue}
                onChange={(e) => onChange(e.target.value)}
                className="bg-white"
                placeholder="e.g. 'Install App'"
              />
            </div>
          </div>
        </div>
      </AdvancedOptionToggle>
    </div>
  );
};

const InlineTriggers = ({
  localSurvey,
  setLocalSurvey,
}: {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
}) => {
  const [isNoCodeAction, setIsNoCodeAction] = useState(false);

  const onNoCodeActionToggle = (checked: boolean) => {
    setIsNoCodeAction(!isNoCodeAction);
    if (!checked) {
      setLocalSurvey((prevSurvey) => ({
        ...prevSurvey,
        inlineTriggers: {
          ...prevSurvey.inlineTriggers,
          noCodeConfig: undefined,
        },
      }));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <CodeActionSelector localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />

      <AdvancedOptionToggle
        title="No Code Action"
        description="Trigger this survey on a No Code Action"
        htmlId="noCodeAction"
        isChecked={isNoCodeAction}
        onToggle={onNoCodeActionToggle}
        childBorder={false}>
        <div className="flex w-full flex-col gap-8 rounded-lg border border-slate-200 bg-slate-50 p-6">
          <CssSelector localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />
          <PageUrlSelector localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />
          <InnerHtmlSelector localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />
        </div>
      </AdvancedOptionToggle>
    </div>
  );
};

export default InlineTriggers;
