import dotenv from "dotenv";
import winston from "winston";

dotenv.config();

const consoleTransport = new winston.transports.Console({
  format: process.env.NODE_ENV == "production" ? undefined : winston.format.combine(winston.format.colorize(), winston.format.simple())
});

const defaultLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV == "production" ? "info" : "debug");

export const logger = winston.loggers.add("server", {
  level: defaultLevel,
  format: winston.format.combine(winston.format.label({ label: "server" }), winston.format.json()),
  transports: [consoleTransport]
});

export const executorLogger = winston.loggers.add("executor", {
  level: defaultLevel,
  format: winston.format.combine(winston.format.label({ label: "executor" }), winston.format.json()),
  transports: [consoleTransport]
});
