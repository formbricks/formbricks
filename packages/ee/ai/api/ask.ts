export const runtime = "edge";

import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { OPENAI_API_KEY } from "@formbricks/lib/constants";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export async function askAi(prompt: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    stream: true,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
