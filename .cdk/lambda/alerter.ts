import {CloudWatchLogsEvent, Context} from "aws-lambda";
import * as zlib from "zlib";
import {getParameter} from "@aws-lambda-powertools/parameters/ssm";

export const isValidCwLogEvent = (event: CloudWatchLogsEvent): boolean => {
    return !!(
        event
        && event.awslogs
        && event.awslogs.data
    );
}

export const parseLogs = (event: CloudWatchLogsEvent) : any => {
    if (isValidCwLogEvent(event)) {
        try {
            const payload = Buffer.from(event.awslogs.data, 'base64');
            return JSON.parse(zlib.unzipSync(payload).toString());
        } catch (ex) {
            console.error(`[ERROR] parseLogs() -> Failed to process the log event, ex: ${ex}`);
        }
    }
    return event;
}

/**
 * Sends error logs from Aws CloudWatch to Slack.
 *
 * @param event
 * @param context
 */
export const handler = async (event: CloudWatchLogsEvent, context: Context): Promise<any> => {
    const processedLogs = parseLogs(event);

    const url = await getParameter('/surveys-digiopinion/slack/webhook/url');
    if (!url) {
        throw new Error('Slack webhook url not found');
    }

    for (const logEvent of processedLogs.logEvents) {
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(logEvent.message);
            parsedMessage = JSON.parse(parsedMessage) // try to parse the message again to get the actual message
        } catch (ex) {
            parsedMessage = logEvent.message; // the message is not a JSON
        }
        console.log(parsedMessage);
        await sendToSlack(parsedMessage, url);
    }

    return processedLogs;
};

export const sendToSlack = async (message: any, url: string) => {

    // Send logs to Slack
    const slackMessage = {
        text: `:fire: Error logs`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text:  message ,
                },
            },
        ],
    };
    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackMessage),
    });
};
