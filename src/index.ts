import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import expressWinston from "express-winston";

import { ExecutorPool, HashNotFoundError } from "./executorPool";

dotenv.config();

import { logger } from "./logger";
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

app.listen(port, "0.0.0.0", () => {
  logger.log("info", `server started at http://0.0.0.0:${port}`);
});
