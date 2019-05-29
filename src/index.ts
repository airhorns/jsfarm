import dotenv from "dotenv";
dotenv.config();
import {} from "./instrumentation";

import express from "express";
import bodyParser from "body-parser";
import expressWinston from "express-winston";
import { getJSFarmVersion } from "./utils";
import { ExecutorPool, HashNotFoundError } from "./executorPool";
import { logger } from "./loggers";

const version = getJSFarmVersion();
const pool = new ExecutorPool();
const port = parseInt(process.env.SERVER_PORT || "3006", 10);
const app = express();

app.use(bodyParser.json({ limit: "50mb" }));
app.use(expressWinston.logger(logger));

app.get("/healthz", (req, res) => res.end("200 OK"));

app.post("/exec/hash", async (req, res) => {
  const { hash, args } = req.body;
  try {
    const result = await pool.executeHash(hash, args);
    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof HashNotFoundError) {
      res.status(404);
      res.type("txt").send("Script hash not found");
    } else {
      res.json({ success: false, error });
    }
  }
});

app.post("/exec/script", async (req, res) => {
  const { script, args } = req.body;
  try {
    const result = await pool.executeScript(script, args);
    res.json({ success: true, ...result });
  } catch (error) {
    res.json({ success: false, error });
  }
});

const server = app.listen(port, "0.0.0.0", () => {
  logger.log("info", `server version ${version} started at http://0.0.0.0:${port}`);
});

const shutdownHandler = async () => {
  console.log("received shutdown signal, draining pool");
  await server.close();
  await pool.drain();
  process.exit(0);
};

process.on("SIGTERM", shutdownHandler);
process.on("SIGINT", shutdownHandler);
