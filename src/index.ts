import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import expressWinston from "express-winston";

import { ExecutorPool } from "./executorPool";
import { Executor } from "./executor";

dotenv.config();

import { logger } from "./logger";
const pool = new ExecutorPool();
const port = parseInt(process.env.SERVER_PORT || "-1", 10);
const app = express();

const execute = async (executor: Executor, args: any) => {
  let result;
  try {
    result = { success: true, ...(await executor.execute(args)) };
  } catch (error) {
    result = { success: false, error };
  }

  return result;
};

app.use(bodyParser.json({ limit: "50mb" }));
app.use(expressWinston.logger(logger));

app.get("/healthz", (req, res) => res.end("200 OK"));

app.post("/exec/hash", async (req, res) => {
  const { hash, args } = req.body;
  const executor = pool.forHash(hash);
  if (executor) {
    const result = await execute(executor, args);
    res.json(result);
  } else {
    res.status(404);
    res.type("txt").send("Script hash not found");
  }
});

app.post("/exec/script", async (req, res) => {
  const { script, args } = req.body;
  const executor = pool.forScript(script);
  const result = await execute(executor, args);
  res.json(result);
});

app.listen(port, "0.0.0.0", () => {
  logger.log("info", `server started at http://0.0.0.0:${port}`);
});
