import { Column, Container, Img, Link, Row, Text } from "@react-email/components";
import { TFunction } from "i18next";
import { FileIcon } from "lucide-react";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { getOriginalFileNameFromUrl } from "@/modules/storage/utils";

export const renderEmailResponseValue = async (
  response: string | string[],
  questionType: TSurveyElementTypeEnum,
  t: TFunction,
  overrideFileUploadResponse = false
): Promise<React.JSX.Element> => {
  switch (questionType) {
    case TSurveyElementTypeEnum.FileUpload:
      return (
        <Container>
          {overrideFileUploadResponse ? (
            <Text className="mt-0 text-sm break-words whitespace-pre-wrap italic">
              {t("emails.render_email_response_value_file_upload_response_link_not_included")}
            </Text>
          ) : (
            Array.isArray(response) &&
            response.map((responseItem) => (
              <Link
                className="mt-2 flex flex-col items-center justify-center rounded-lg bg-slate-200 p-2 text-sm text-black shadow-sm"
                href={responseItem}
                key={responseItem}>
                <FileIcon className="h-4 w-4" />
                <Text className="mx-auto mb-0 truncate text-sm">
                  {getOriginalFileNameFromUrl(responseItem)}
                </Text>
              </Link>
            ))
          )}
        </Container>
      );

    case TSurveyElementTypeEnum.PictureSelection:
      return (
        <Container>
          <Row>
            {Array.isArray(response) &&
              response.map((responseItem) => (
                <Column key={responseItem}>
                  <Img alt={responseItem.split("/").pop()} className="m-2 h-28" src={responseItem} />
                </Column>
              ))}
          </Row>
        </Container>
      );

    case TSurveyElementTypeEnum.Ranking:
      return (
        <Container>
          <Row className="mb-2 text-sm text-slate-700" dir="auto">
            {Array.isArray(response) &&
              response.filter(Boolean).map((item, index) => (
                <Row key={item} className="mb-1 flex items-center">
                  <Column className="w-6 text-slate-400">#{index + 1}</Column>
                  <Column className="rounded bg-slate-100 px-2 py-1">{item}</Column>
                </Row>
              ))}
          </Row>
        </Container>
      );

    default:
      return <Text className="mt-0 text-sm break-words whitespace-pre-wrap">{response}</Text>;
  }
};
