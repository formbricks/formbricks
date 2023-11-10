export const runtime = "edge";

import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { OPENAI_API_KEY } from "@formbricks/lib/constants";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export async function askAi(instruction: string, data: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    stream: true,
    messages: [
      {
        role: "system",
        content: "You are a Formbricks helpful assistant",
      },
      {
        role: "user",
        content: `${instruction}. Make sure to not reveal any personal data. Here's the data: ${data}}`,
      },
    ],
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
