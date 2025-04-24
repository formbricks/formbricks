import { createRedisClient } from "@/lib/worker/redis-connection";
import { QueueName } from "@/lib/worker/service";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Queue } from "bullmq";
import { Hono } from "hono";

const app = new Hono();
const basePath = "/api/queues";

const redisClient = createRedisClient();

// Create the Express adapter
const serverAdapter = new HonoAdapter(serveStatic);

// Create Bull Board with your queues
createBullBoard({
  queues: [
    new BullMQAdapter(
      new Queue(QueueName.RESPONSE, {
        connection: redisClient,
      })
    ),
  ],
  serverAdapter,
});

// Configure the server adapter
serverAdapter.setBasePath(basePath);
app.route(basePath, serverAdapter.registerPlugin());

export const GET = serve(app);
export const POST = serve(app);
export const PUT = serve(app);
