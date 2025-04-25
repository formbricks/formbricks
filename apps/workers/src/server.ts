import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { logger } from "@formbricks/logger";
import { PipelineConsumer } from "./consumers/pipeline-consumer";

dotenv.config();

// Create a Prisma client to connect to the default database
const prisma = new PrismaClient();

async function startServer() {
  // Initialize the pipeline consumer
  const pipelineConsumer = new PipelineConsumer();

  try {
    logger.info("Starting worker server...");

    logger.info("Pipeline consumer initialized and listening for jobs");

    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down worker server...");
      await prisma.$disconnect();
      pipelineConsumer.worker?.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    logger.info("Worker server started successfully");
  } catch (error) {
    logger.error("Failed to start worker server:", error);
    await prisma.$disconnect();
    pipelineConsumer.worker?.close();
    process.exit(1);
  }
}

// Start the server
startServer();
