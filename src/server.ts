import "dotenv/config";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { prisma } from "./db/prisma";

async function main() {
  const env = loadEnv();
  const app = createApp(env);

  const server = app.listen(env.PORT, () => {
    console.log(`fatoven-api listening on port ${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("Failed to start fatoven-api:", error);
  process.exit(1);
});
