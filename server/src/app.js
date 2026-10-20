import cors from "cors";
import express from "express";
import pool from "./db.js";

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function createApp(database = pool) {
  const app = express();

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());

  app.get("/api/health", async (_request, response) => {
    try {
      await database.query("SELECT 1");
      response.json({ status: "ok", database: "connected" });
    } catch (error) {
      console.error("Database health check failed:", error.code ?? error.name);
      response.status(503).json({ status: "error", database: "unavailable" });
    }
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "요청한 리소스를 찾을 수 없습니다." });
  });

  return app;
}

const app = createApp();

export default app;
