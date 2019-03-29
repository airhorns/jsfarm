import * as subprocess from "child_process";
import { executorLogger } from "./loggers";
import winston = require("winston");

const NODE_BINARY = process.execPath;

// Indicates something wrong with the executor subsystem, not the script itself.
export class ExecutorSystemicError extends Error {}

export interface Result {
  result: any;
  logs: [string];
}

export class Executor {
  hash: string;
  script: string;
  killed: boolean;
  process: subprocess.ChildProcess;
  timeout: number;
  logger: winston.Logger;
  currentExecution?: {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timer;
    finished: boolean;
    logs: string[];
  };

  constructor(hash: string, script: string) {
    this.hash = hash;
    this.script = script;
    this.timeout = 2000;

    const args = ["--no-warnings", "build/harness.js"];
    executorLogger.log("info", `spawn ${NODE_BINARY} ${args}.join(" ")`);
    this.process = subprocess.spawn(NODE_BINARY, args, {
      detached: false,
      shell: false,
      env: {}
    });
    this.process.on("error", this.handleError);
    this.process.on("close", this.handleClose);
    this.process.stdout && this.process.stdout.on("data", this.handleData);
    this.process.stderr && this.process.stderr.on("data", this.handleStderr);
    this.logger = executorLogger.child({ pid: this.process.pid });
    this.write({ script });
    this.killed = false;
  }

  get ready() {
    return !this.killed;
  }

  handleData = (line: Buffer) => {
    const str = line.toString();
    this.logger.log("debug", `stdout: ${str.trim()}`);

    if (this.currentExecution) {
      try {
        const message = JSON.parse(str);
        if (message.log) {
          this.currentExecution.logs.push(message.log);
        } else if (message.error) {
          this.doReject(message.errorMessage);
        } else if (message.complete) {
          this.doResolve(message.result);
        } else {
          this.doReject(`Script replied with an unknown message: ${JSON.stringify(message)}`);
        }
      } catch (e) {
        this.doReject(`Error processing message from script: ${e}`);
        this.kill("error processing child message");
      }
    } else {
      this.logger.log("error", `==> Unexpected message from script while not executing: ${line}`);
    }
  };

  handleStderr = (line: Buffer) => {
    const str = line.toString();
    this.logger.log("debug", `==> stderr: ${str.trim()}`);

    if (this.currentExecution) {
      this.currentExecution.logs.push(str);
    }
  };

  handleError = (err: Error) => {
    this.logger.log("debug", `==> error: ${err}`);
    if (this.currentExecution) this.doReject(`Script failed to execute with error "${err}"`);
    this.kill("child process errored");
  };

  handleClose = (code: number, signal: string) => {
    this.logger.log("debug", `==> close: code: ${code}, signal: ${signal}`);
    if (this.currentExecution && !this.currentExecution.finished) {
      this.doReject(`Script exited with exit code ${code} with signal ${signal}`);
    }
    this.kill("child process closed pipes");
  };

  kill(reason: string) {
    if (this.killed) {
      return;
    }
    this.killed = true;
    this.logger.log("info", `Killing executor. Reason: ${reason}`);
    this.logger.log("debug", "<== SIGTERM");
    this.process.kill("SIGTERM");
  }

  doReject(message: string) {
    if (!this.currentExecution) {
      throw new ExecutorSystemicError("trying to reject executor who no longer has an execution outstanding");
    }
    if (this.currentExecution.finished) {
      throw new ExecutorSystemicError("trying to re-resolve execution which has already been resolved or rejected");
    }

    clearTimeout(this.currentExecution.timeout);
    this.currentExecution.finished = true;
    this.currentExecution.reject({ error: true, message, logs: this.currentExecution.logs });
    this.currentExecution = undefined;
  }

  doResolve(result: any) {
    if (!this.currentExecution) {
      throw new ExecutorSystemicError("trying to resolve executor with no outstanding execution");
    }
    if (this.currentExecution.finished) {
      throw new ExecutorSystemicError("trying to re-resolve execution which has already been resolved or rejected");
    }

    clearTimeout(this.currentExecution.timeout);
    this.currentExecution.finished = true;
    this.currentExecution.resolve({ result, logs: this.currentExecution.logs });
    this.currentExecution = undefined;
  }

  async execute(args: any) {
    if (!this.ready) {
      throw new ExecutorSystemicError("Can't execute on this executor as it is not ready (it has been killed)");
    }
    if (this.currentExecution) {
      throw new ExecutorSystemicError("Can't execute on this executor as it is already executing");
    }

    const timeout = setTimeout(() => {
      if (this.currentExecution && !this.currentExecution.finished) {
        this.logger.log("debug", "Script execution timed out");
        this.doReject(`Script execution timed out after ${this.timeout}ms`);
      }
    }, this.timeout);

    return new Promise<Result>((resolve, reject) => {
      this.currentExecution = { resolve, reject, timeout, finished: false, logs: [] };
      this.write({ args });
    });
  }

  private write(data: any) {
    const json = JSON.stringify(data);
    this.logger.log("debug", `<== stdin: ${json.slice(0, 100)}`);
    this.process.stdin && this.process.stdin.write(json + "\n");
  }
}
