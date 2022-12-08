interface sendToHqProps {
  submission: { customerId: string; data: any };
  schema: any;
  event?: React.BaseSyntheticEvent<object, any, any> | undefined;
}

export const sendToHq = async ({ submission, schema }: sendToHqProps) => {
  try {
    if (!schema.config.formId) {
      console.warn(`🧱 FormBricks: formId not set in <Form />. Can't send submission to Formbricks HQ.`);
      return;
    }
    // send answer to Formbricks HQ
    await Promise.all([
      await fetch(
        `${schema.config.hqUrl || "https://hq.formbricks.com"}/api/capture/forms/${
          schema.config.formId
        }/submissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submission),
        }
      ),
      await fetch(
        `${schema.config.hqUrl || "https://hq.formbricks.com"}/api/capture/forms/${
          schema.config.formId
        }/schema`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(schema),
        }
      ),
    ]);
  } catch (e) {
    console.error(`🧱 FormBricks: Unable to send submission to Formbricks HQ. Error: ${e}`);
  }
};
