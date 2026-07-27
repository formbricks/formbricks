export interface TSurveySchedulingConfig {
  timeZone: string;
  localHour: number;
  localMinute: number;
}

const padSchedulingTimePart = (value: number): string => value.toString().padStart(2, "0");

export const getSurveySchedulingTimeLabel = (config: TSurveySchedulingConfig): string =>
  `${padSchedulingTimePart(config.localHour)}:${padSchedulingTimePart(config.localMinute)}`;
