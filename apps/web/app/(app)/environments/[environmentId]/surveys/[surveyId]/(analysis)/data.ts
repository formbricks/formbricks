import { getDisplayCountBySurveyId } from "@formbricks/lib/display/service";
import { getResponses } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";

export const getAnalysisData = async (surveyId: string, environmentId: string) => {
  const [survey, team, responses, displayCount] = await Promise.all([
    getSurvey(surveyId),
    getTeamByEnvironmentId(environmentId),
    getResponses(surveyId, undefined, {
      // finished: true,
      // finished: false,

      // createdAt: {
      //   min: new Date("2023-12-27"),
      //   max: new Date("2023-12-30"),
      // },

      // clqroy7j00004zzrxvgtl42z9: "first"
      // "clqroy9mp0006zzrxkvwkmstw": "respo"
      // "clqrvyu0g0003k6j8lzl5pzho": "response"
      // "clqrvz1aq0005k6j8w4bhqm2q": "no_new_tag"
      // "clqrvys6c0001k6j8ea4onvzg": "second"
      // "clqrvz50l0007k6j81971xf9v": "humpe to hai hi naa"
      // tags: {
      // applied: ["clqroy7j00004zzrxvgtl42z9", "clqrvys6c0001k6j8ea4onvzg"],
      // notApplied: ["clqroy9mp0006zzrxkvwkmstw"],
      // },
      // tags: {
      //   applied: ["clqroy7j00004zzrxvgtl42z9"],
      //   notApplied: ["clqrvz1aq0005k6j8w4bhqm2q"],
      // },

      data: {
        // sdn0d923dkx034bnv5sn8j20: {
        //   op: "equals",
        //   value: "testing",
        // },
        // wx8t9nc6bi03fdrzf9jrba38: {
        //   op: "clicked",
        // },
        // fwo21epgih42rntmw2gvqx1e: {
        //   op: "includesOne",
        //   value: ["Palms 🌴", "Ocean 🌊"],
        // },
        // fwo21epgih42rntmw2gvqx1e: {
        //   op: "includesAll",
        //   value: ["Palms 🌴", "Ocean 🌊"],
        // },
        // z3aro85eec5qwc320qco4exp: {
        //   op: "greaterThan",
        //   value: 7,
        // },
        // z3aro85eec5qwc320qco4exp: {
        //   op: "lessThan",
        //   value: 7,
        // },
        // z3aro85eec5qwc320qco4exp: {
        //   op: "greaterEqual",
        //   value: 6,
        // },
        // z3aro85eec5qwc320qco4exp: {
        //   op: "lessEqual",
        //   value: 8,
        // },
        // z3aro85eec5qwc320qco4exp: {
        //   op: "notEquals",
        //   value: 8,
        // },
        // fwo21epgih42rntmw2gvqx1e: {
        //   op: "skipped",
        // },
        // fwo21epgih42rntmw2gvqx1e: {
        //   op: "submitted",
        // },
        // mucg3jn9abgie6i5kqg7jx9o: {
        //   op: "uploaded",
        // },
        // mucg3jn9abgie6i5kqg7jx9o: {
        //   op: "notUploaded",
        // },
        // evsj83u1zaw1wbxybdpil6ve: {
        //   op: "booked",
        // },
        // h2las7efr9ie3xn16jcyzzbm: {
        //   op: "skipped",
        // },
        // r696jhcsr20009cynta9agj2: {
        //   op: "notEquals",
        //   value: "Have the cake 🎂",
        // },
      },
    }),
    getDisplayCountBySurveyId(surveyId),
  ]);
  if (!survey) throw new Error(`Survey not found: ${surveyId}`);
  if (!team) throw new Error(`Team not found for environment: ${environmentId}`);
  if (survey.environmentId !== environmentId) throw new Error(`Survey not found: ${surveyId}`);
  const responseCount = responses.length;

  return { responses, responseCount, survey, displayCount };
};
