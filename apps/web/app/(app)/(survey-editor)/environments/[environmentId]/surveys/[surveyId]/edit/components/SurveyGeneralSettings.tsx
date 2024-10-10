import { getAllCountries } from "@/app/(app)/environments/[environmentId]/actions";
import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import Select from "react-select";
import { cn } from "@formbricks/lib/cn";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { AdvancedOptionToggle } from "@formbricks/ui/components/AdvancedOptionToggle";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";
import { QuestionFormInput } from "@formbricks/ui/components/QuestionFormInput";
import { getTagsForSurveyAction } from "@formbricks/ui/components/SurveysList/actions";
import { SurveyTagsWrapper } from "@formbricks/ui/components/SurveysList/components/SurveyTagsWrapper";
import { Switch } from "@formbricks/ui/components/Switch";

interface SurveyGeneralSettingsProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey | ((s: TSurvey) => TSurvey)) => void;
  product: TProduct;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  attributeClasses: TAttributeClass[];
  environmentTags: TTag[];
  environmentId: string;
}

const SURVEY_FAILED_HEADLINE = "Survey Failed";
const SURVEY_FAILED_SUBHEADER = "Submission unsuccessful.";

export function SurveyGeneralSettings({
  localSurvey,
  setLocalSurvey,
  product,
  isInvalid,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
  environmentTags,
  environmentId,
}: SurveyGeneralSettingsProps) {
  const [open, setOpen] = useState(true);
  const [customReward, setCustomReward] = useState(localSurvey.reward);
  const [usingCustomReward, setUsingCustomReward] = useState(
    localSurvey.reward !== product.defaultRewardInUSD
  );
  const [failureChance, setFailureChance] = useState(localSurvey.failureChance);
  const [hasFailureChance, setHasFailureChance] = useState(localSurvey.failureChance > 0);

  const toggleUsingDefaultReward = (isChecked: boolean) => {
    setUsingCustomReward(isChecked);
    setLocalSurvey({
      ...localSurvey,
      reward: isChecked ? customReward : product.defaultRewardInUSD,
    });
  };

  const updateSurveyReward = (e) => {
    let newValue = parseFloat(e.target.value);
    if (isNaN(newValue)) newValue = 0;
    newValue = Math.min(Math.max(newValue, 0), 20);
    setCustomReward(newValue);
    setLocalSurvey({
      ...localSurvey,
      reward: newValue,
    });
  };

  const toggleFailureChance = (isChecked: boolean) => {
    setHasFailureChance(isChecked);
    const enabledFailureCard = localSurvey.failureCard;
    enabledFailureCard.enabled = true;
    setLocalSurvey({
      ...localSurvey,
      failureChance: isChecked ? failureChance : 0,
      failureCard: isChecked ? enabledFailureCard : { enabled: false },
    });
  };

  const updateFailureRate = (e) => {
    let newValue = parseFloat(e.target.value);
    if (isNaN(newValue)) newValue = 0;
    newValue = Math.min(Math.max(newValue, 1), 100);
    setFailureChance(newValue);
    setLocalSurvey({
      ...localSurvey,
      failureChance: newValue,
    });
  };

  interface Country {
    name: string;
    isoCode: string;
  }

  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    const fetchCountries = async () => {
      const countriesData = await getAllCountries();
      setCountries(countriesData);
    };

    fetchCountries();
    updateFetchedSurveys();
  }, []);

  const handleCountryChange = (selectedCountries) => {
    const updatedCountries = selectedCountries.map((country) => ({
      isoCode: country.value,
      name: country.label,
    }));

    setLocalSurvey((prevState) => ({
      ...prevState,
      countries: updatedCountries,
      limitedCountries: updatedCountries.length > 0,
    }));
  };

  const updateFetchedSurveys = async () => {
    const fetchedTags = await getTagsForSurveyAction({ surveyId: localSurvey.id });
    setLocalSurvey((prevState) => ({
      ...prevState,
      tags: fetchedTags.data,
    }));
  };

  const [limitedToCountries, setLimitedToCountries] = useState(localSurvey.countries.length > 0);

  const toggleLimitedToCountries = (isChecked) => {
    setLimitedToCountries(isChecked);
    const newCountries = !isChecked ? [] : localSurvey.countries;
    setLocalSurvey((prevState) => ({
      ...prevState,
      countries: newCountries,
      limitedCountries: newCountries.length > 0,
    }));
  };

  // const [failureCardMessage, setFailureCardMessage] = useState({
  //   headline: SURVEY_FAILED_HEADLINE,
  //   subheader: SURVEY_FAILED_SUBHEADER,
  // });
  const [failureCardMessageToggle, setFailureCardMessageToggle] = useState(localSurvey.failureCard.enabled);

  const toggleCustomFailureScreen = () => {
    setFailureCardMessageToggle((prev) => !prev);
    const defaultHeadline = SURVEY_FAILED_HEADLINE;
    const defaultSubheader = SURVEY_FAILED_SUBHEADER;

    setLocalSurvey({
      ...localSurvey,
      failureCard: {
        enabled: !failureCardMessageToggle,
        headline: localSurvey?.failureCard?.headline
          ? {
              default: !failureCardMessageToggle ? defaultHeadline : localSurvey.failureCard.headline.default,
            }
          : { default: defaultHeadline },
        subheader: localSurvey?.failureCard?.subheader
          ? {
              default: !failureCardMessageToggle
                ? defaultSubheader
                : localSurvey.failureCard.subheader.default,
            }
          : { default: defaultSubheader },
      },
    });
  };

  const [showFailureCardCTA, setshowFailureCardCTA] = useState<boolean>(
    getLocalizedValue(localSurvey.failureCard.buttonLabel, "default") || localSurvey.failureCard.buttonLink
      ? true
      : false
  );

  const updateSurvey = (data) => {
    const updatedSurvey = {
      ...localSurvey,
      failureCard: {
        ...localSurvey.failureCard,
        ...data,
      },
    };
    setLocalSurvey(updatedSurvey);
  };

  const [redirectToggle, setRedirectToggle] = useState(
    localSurvey.redirectOnFailUrl != null && localSurvey.redirectOnFailUrl != ""
  );
  const [urlError, setUrlError] = useState(localSurvey.redirectOnFailUrl == null);
  const [redirectOnFailUrl, setRedirectOnFailUrl] = useState<string | null>(localSurvey.redirectOnFailUrl);

  const handleRedirectCheckMark = () => {
    setRedirectToggle((prev) => !prev);

    if (!localSurvey.redirectOnFailUrl) {
      setRedirectOnFailUrl(product.defaultRedirectOnFailUrl ?? null);
      setLocalSurvey({ ...localSurvey, redirectOnFailUrl: redirectOnFailUrl });
    }

    if (redirectToggle && localSurvey.redirectOnFailUrl) {
      setRedirectOnFailUrl(null);
      setLocalSurvey({ ...localSurvey, redirectOnFailUrl: null });
    }
  };

  const handleRedirectUrlChange = (link: string) => {
    setRedirectOnFailUrl(link);
    setLocalSurvey({ ...localSurvey, redirectOnFailUrl: link });
  };

  const validateUrl = (e) => {
    const url = e.target.value;
    const urlPattern = /^(http|https):\/\/[^ "]+$/;

    if (!urlPattern.test(url)) {
      setUrlError(true);
    } else {
      setUrlError(false);
    }
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white"
      )}>
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              strokeWidth={3}
              className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
            />{" "}
          </div>
          <div>
            <p className="font-semibold text-slate-800">Survey General Settings</p>
            <p className="mt-1 text-sm text-slate-500">Choose language, countries and reward for survey.</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <div className="p-3">
            <div className="ml-2 flex items-center space-x-1">
              <Switch
                id="customReward"
                checked={usingCustomReward}
                onCheckedChange={toggleUsingDefaultReward}
              />
              <Label htmlFor="customReward" className="cursor-pointer">
                <div className="ml-2">
                  <h3 className="text-sm font-semibold text-slate-700">Use Custom Reward</h3>
                  <p className="text-xs font-normal text-slate-500">Change the reward for this survey.</p>
                </div>
              </Label>
            </div>
            {usingCustomReward && (
              <div className="ml-2 mt-2">
                <Label htmlFor="customRewardInput" className="cursor-pointer">
                  Custom Reward:
                </Label>
                <Input
                  autoFocus
                  type="number"
                  id="customRewardInput"
                  step="0.1"
                  onChange={updateSurveyReward}
                  value={customReward}
                  className="ml-2 mr-2 inline w-20 bg-white text-center text-sm"
                />
                <Label htmlFor="dollarSymbol" className="cursor-pointer">
                  $
                </Label>
              </div>
            )}
          </div>
          <div className="p-3">
            <div className="ml-2 flex items-center space-x-1">
              <Switch id="failureChance" checked={hasFailureChance} onCheckedChange={toggleFailureChance} />
              <Label htmlFor="failureChance" className="cursor-pointer">
                <div className="ml-2">
                  <h3 className="text-sm font-semibold text-slate-700">Enable Survey Failure Chance</h3>
                  <p className="text-xs font-normal text-slate-500">
                    Set the chance for a completion to be treated as failed.
                  </p>
                </div>
              </Label>
            </div>

            {hasFailureChance && (
              <div className="ml-4 mt-2">
                <Label htmlFor="failureChanceInput" className="cursor-pointer">
                  Failure Chance:
                </Label>
                <Input
                  autoFocus
                  type="number"
                  id="failureChanceInput"
                  step="1"
                  onChange={updateFailureRate}
                  value={failureChance}
                  className="ml-2 mr-2 inline w-20 bg-white text-center text-sm"
                />
                <Label htmlFor="failureChanceInput" className="cursor-pointer">
                  %
                </Label>
                {failureChance === 100 && (
                  <Label className="ml-2 text-sm text-yellow-500">
                    It will not be possible for panelists to complete this survey successfully!
                  </Label>
                )}
              </div>
            )}

            {hasFailureChance && (
              <AdvancedOptionToggle
                htmlId="redirectOnFailUrl"
                isChecked={redirectToggle}
                onToggle={handleRedirectCheckMark}
                title="Redirect on failure"
                description="Redirect user to specified link on survey failure"
                childBorder={true}>
                <div className="w-full p-4">
                  <div className="flex w-full cursor-pointer items-center">
                    <p className="mr-2 w-[400px] text-sm font-semibold text-slate-700">Redirect here:</p>
                    <Input
                      autoFocus
                      className="w-full bg-white"
                      type="url"
                      placeholder="https://www.example.com"
                      value={redirectOnFailUrl ? redirectOnFailUrl : ""}
                      onChange={(e) => handleRedirectUrlChange(e.target.value)}
                      onBlur={validateUrl}
                    />
                  </div>
                  {urlError && <p className="mt-2 text-sm text-red-500">Please enter a valid URL.</p>}
                </div>
              </AdvancedOptionToggle>
            )}

            {hasFailureChance && (
              <AdvancedOptionToggle
                htmlId="failureRateToggle"
                isChecked={failureCardMessageToggle}
                onToggle={toggleCustomFailureScreen}
                title="Use custom fail screen text"
                description="Customise the text on the fail screen."
                childBorder={true}>
                <form className="px-4 pb-6">
                  <QuestionFormInput
                    id="headline"
                    label="Headline"
                    value={localSurvey?.failureCard?.headline}
                    localSurvey={localSurvey}
                    questionIdx={localSurvey.questions.length}
                    isInvalid={isInvalid}
                    updateSurvey={updateSurvey}
                    selectedLanguageCode={selectedLanguageCode}
                    setSelectedLanguageCode={setSelectedLanguageCode}
                    attributeClasses={attributeClasses}
                    fail={true}
                  />

                  <QuestionFormInput
                    id="subheader"
                    label="Subheader"
                    value={localSurvey?.failureCard?.subheader}
                    localSurvey={localSurvey}
                    questionIdx={localSurvey.questions.length}
                    isInvalid={isInvalid}
                    updateSurvey={updateSurvey}
                    selectedLanguageCode={selectedLanguageCode}
                    setSelectedLanguageCode={setSelectedLanguageCode}
                    attributeClasses={attributeClasses}
                    fail={true}
                  />
                  <div className="mt-4">
                    <div className="flex items-center space-x-1">
                      <Switch
                        id="showButton"
                        checked={showFailureCardCTA}
                        onCheckedChange={() => {
                          if (showFailureCardCTA) {
                            updateSurvey({ buttonLabel: undefined, buttonLink: undefined });
                          } else {
                            updateSurvey({
                              buttonLabel: { default: "Join DigiOpinion" },
                              buttonLink: "https://digiopinion.com",
                            });
                          }
                          setshowFailureCardCTA(!showFailureCardCTA);
                        }}
                      />
                      <Label htmlFor="showButton" className="cursor-pointer">
                        <div className="ml-2">
                          <h3 className="text-sm font-semibold text-slate-700">Show Button</h3>
                          <p className="text-xs font-normal text-slate-500">
                            Send your respondents to a page of your choice.
                          </p>
                        </div>
                      </Label>
                    </div>
                    {showFailureCardCTA && (
                      <div className="border-1 mt-4 space-y-4 rounded-md border bg-slate-100 p-4 pt-2">
                        <div className="space-y-2">
                          <QuestionFormInput
                            id="buttonLabel"
                            label="Button Label"
                            placeholder="Join DigiOpinion"
                            className="bg-white"
                            value={localSurvey.failureCard.buttonLabel}
                            localSurvey={localSurvey}
                            questionIdx={localSurvey.questions.length}
                            isInvalid={isInvalid}
                            updateSurvey={updateSurvey}
                            selectedLanguageCode={selectedLanguageCode}
                            setSelectedLanguageCode={setSelectedLanguageCode}
                            attributeClasses={attributeClasses}
                            fail={true}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Button Link</Label>
                          <Input
                            id="buttonLink"
                            name="buttonLink"
                            className="bg-white"
                            placeholder="https://digiopinion.com"
                            value={localSurvey.failureCard.buttonLink}
                            onChange={(e) => updateSurvey({ buttonLink: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </form>
              </AdvancedOptionToggle>
            )}
          </div>
          <div className="p-3">
            <div className="ml-2 flex items-center space-x-1">
              <Switch
                id="limitedToCountries"
                checked={limitedToCountries}
                onCheckedChange={toggleLimitedToCountries}
                className={"mr-2"}
              />
              <Label htmlFor="countries" className="cursor-pointer">
                <div className="ml-2">
                  <h3 className="text-sm font-semibold text-slate-700">Limit to Countries</h3>
                  <p className="text-xs font-normal text-slate-500">
                    Make the survey available only to certain countries.
                  </p>
                </div>
              </Label>
            </div>
            {limitedToCountries && (
              <div className="mt-4">
                {" "}
                {/* Add margin-top to create space */}
                <Select
                  options={countries.map((country) => ({
                    value: country.isoCode,
                    label: country.name,
                  }))}
                  isMulti
                  isSearchable
                  onChange={handleCountryChange}
                  value={localSurvey.countries.map((country) => ({
                    value: country.isoCode,
                    label: country.name,
                  }))}
                />
              </div>
            )}
          </div>
          <div className="p-3">
            <SurveyTagsWrapper
              environmentId={environmentId}
              surveyId={localSurvey.id}
              tags={localSurvey.tags.map((tag) => ({
                tagId: tag.id,
                tagName: tag.name,
              }))}
              environmentTags={environmentTags}
              updateFetchedSurveys={updateFetchedSurveys}
              isViewer={false}
            />
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
