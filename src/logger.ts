import dotenv from "dotenv";
import winston from "winston";

dotenv.config();

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info"
});

logger.add(
  new winston.transports.Console({
    format:
      process.env.NODE_ENV == "production"
        ? undefined
        : winston.format.combine(winston.format.colorize(), winston.format.simple())
  })
);
