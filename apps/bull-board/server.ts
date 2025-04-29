import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Queue } from "bullmq";
import dotenv from "dotenv";
import express from "express";
import { closeRedisConnection, createRedisClient } from "@formbricks/redis";
import { QueueName } from "@formbricks/worker";

dotenv.config();

const app = express();
const basePath = "/admin/queues";

const redisClient = createRedisClient();

// Create the Express adapter
const serverAdapter = new ExpressAdapter();

// Create Bull Board with your queues
createBullBoard({
  queues: [
    new BullMQAdapter(
      new Queue(QueueName.PIPELINE, {
        connection: redisClient,
      })
    ),
  ],
  serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

// Configure the server adapter
serverAdapter.setBasePath(basePath);
app.listen(process.env.QUEUE_UI_PORT || 3001, () => {
  console.log(`Running on ${process.env.QUEUE_UI_PORT || 3001}...`);
  console.log(`For the UI, open http://localhost:${process.env.QUEUE_UI_PORT || 3001}/admin/queues`);
  console.log("Make sure Redis is running on port 6379 by default");
});

// Handle graceful shutdown
const gracefulShutdown = async () => {
  console.log("Shutting down Bull Board server...");
  await closeRedisConnection();
  // Add any cleanup here if needed
  process.exit(0);
};

// Listen for termination signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
