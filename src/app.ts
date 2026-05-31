import cors from "cors";
import express from "express";
import type { Env } from "./config/env";
import { registerModules } from "./modules";
import { errorHandler } from "./shared/http";

export function createApp(env: Env) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "fatoven-api" });
  });

  registerModules(app, env);

  app.use(errorHandler);

  return app;
}
