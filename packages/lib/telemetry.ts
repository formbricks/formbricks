/* We use this telemetry service to better understand how Formbricks is being used
   and how we can improve it. All data including the IP address is collected anonymously
   and we cannot trace anything back to you or your customers. If you still want to
   disable telemetry, set the environment variable TELEMETRY_DISABLED=1 */

export const captureTelemetry = async (eventName: string, properties = {}) => {
  if (
    process.env.TELEMETRY_DISABLED !== "1" &&
    process.env.NODE_ENV === "production" &&
    process.env.INSTANCE_ID
  ) {
    try {
      await fetch("https://eu.posthog.com/capture/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: "phc_6XBUthOJLVe0Ij9EYkwEKpV96fUbA1aXxnHDq5ryASk",
          event: eventName,
          properties: {
            distinct_id: process.env.INSTANCE_ID,
            ...properties,
          },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.log("error sending telemetry:", error);
    }
  }
};
