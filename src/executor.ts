import * as subprocess from "child_process";
import { logger } from "./logger";

const NODE_BINARY = process.execPath;

export interface Result {
  result: any;
  logs: [string];
}

export class Executor {
  hash: string;
  script: string;
  ready: boolean;
  process: subprocess.ChildProcess;
  timeout: number;
  currentPromise?: {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timer;
    logs: string[];
  };

  constructor(hash: string, script: string) {
    this.hash = hash;
    this.script = script;
    this.timeout = 2000;

    const args = ["--no-warnings", "build/harness.js"];
    logger.log("debug", `=>spawn ${NODE_BINARY} ${args}.join(" ")`);
    this.process = subprocess.spawn(NODE_BINARY, args, {
      detached: false,
      shell: false,
      env: {}
    });
    this.process.on("error", this.handleError);
    this.process.on("close", this.handleClose);
    this.process.stdout && this.process.stdout.on("data", this.handleData);
    this.process.stderr && this.process.stderr.on("data", this.handleStderr);
    this.write({ script });
    this.ready = true;
  }

  handleData = (line: Buffer) => {
    const str = line.toString();
    logger.log("debug", `==> stdout: ${str.trim()}`);

    if (this.currentPromise) {
      try {
        const message = JSON.parse(str);
        if (message.log) {
          this.currentPromise.logs.push(message.log);
        } else if (message.error) {
          this.doRejectOrKill(message.errorMessage);
        } else if (message.complete) {
          this.doResolve(message.result);
        } else {
          this.doRejectOrKill(`Script replied with an unknown message: ${JSON.stringify(message)}`);
        }
      } catch (e) {
        this.doRejectOrKill(`Error processing message from script: ${e}`);
      }
    } else {
      this.kill();
    }
  };

  handleStderr = (line: Buffer) => {
    const str = line.toString();
    logger.log("debug", `--> stderr: ${str.trim()}`);

    if (this.currentPromise) {
      this.currentPromise.logs.push(str);
    }
  };

  handleError = (err: Error) => {
    logger.log("debug", `==> error: ${err}`);
    this.doRejectOrKill(`Script failed to execute with error "${err}"`);
  };

  handleClose = (code: number, signal: string) => {
    logger.log("debug", `==> close: code: ${code}, signal: ${signal}`);
    this.doRejectOrKill(`Script exited with exit code ${code} with signal ${signal}`);
  };

  kill() {
    logger.log("debug", `<== kill`);
    this.ready = false;
    this.process.kill("SIGTERM");
  }

  doRejectOrKill(message: string) {
    if (this.currentPromise) {
      this.currentPromise.reject({ message, logs: this.currentPromise.logs });
      this.currentPromise = undefined;
    } else {
      this.kill();
    }
  }

  doResolve(result: any) {
    if (!this.currentPromise) {
      throw new Error("trying to resolve executor who no longer has a promise outstanding");
    }
    clearTimeout(this.currentPromise.timeout);
    this.currentPromise.resolve({ result, logs: this.currentPromise.logs });
    this.currentPromise = undefined;
  }

  async execute(args: any) {
    if (!this.ready) {
      throw new Error("Can't execute on this executor as it is not ready (it has been killed)");
    }

    const timeout = setTimeout(() => {
      if (this.currentPromise) {
        logger.log("debug", "Script execution timed out");
        this.doRejectOrKill(`Script execution timed out after ${this.timeout}ms`);
      }
    }, this.timeout);

    return new Promise<Result>((resolve, reject) => {
      this.currentPromise = { resolve, reject, timeout, logs: [] };
      this.write({ args });
    });
  }

  private write(data: any) {
    const json = JSON.stringify(data);
    logger.log("debug", `<== stdin: ${json.slice(0, 100)}`);
    this.process.stdin && this.process.stdin.write(json + "\n");
  }
}
