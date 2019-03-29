// JS file executed as a subprocess of the main one to actually do the work
// It does this:
// - boot and define the execution environment
// - read in the JS to execute
// - executes the untrusted script to define the main function
// - blocks on reading new messages in to execute using the main function
import readline from "readline";
import { NodeVM, VMScript } from "vm2";

let setup = false;
let script: any;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const formatError = (e: any, indent = false) => {
  let lines = e.message ? String(e.stack) : String(e);
  if (indent) {
    lines = lines
      .split("\n")
      .map(line => " +---  " + line)
      .join("\n");
  }
  return lines;
};

const scriptLogger = (level: string) => {
  return (...args: any[]) => {
    console.error(`[Script] ${level}:`, ...args);
  };
};

const newVM = () => {
  const vm = new NodeVM({
    console: "redirect",
    sandbox: { module: {} }
  });
  ["debug", "log", "info", "warn", "error"].forEach(level => {
    vm.on(`console.${level}`, scriptLogger(level));
  });
  return vm;
};

const handleError = (positionTag: string, error: any) => {
  console.error(`[Harness] ${positionTag} error executing script, exception follows\n${formatError(error, true)}`);
  console.log(JSON.stringify({ error: true, errorMessage: formatError(error) }));
};

rl.on("line", (line: string) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch (e) {
    console.error("[Harness] JSON parsing error", e);
    process.exit(1);
  }

  if (!setup) {
    // Define the execute script from the first message, and execute it with each future argument
    script = new VMScript(
      message.script +
        `
        module.exports.harness = async (args) => Promise.resolve(module.exports.main.apply(undefined, args)).then(JSON.stringify);
        `
    );

    setup = true;
  } else {
    console.error(`[Harness] executing in pid ${process.pid}: ${JSON.stringify(message).slice(0, 100)}`);
    try {
      const vm = newVM();
      const module = vm.run(script);
      module.harness(message.args).then(
        (result: string) => {
          console.log(`{ "complete": true, "result": ${result} }`);
        },
        (rejectReason: any) => {
          handleError("async", rejectReason);
        }
      );
    } catch (error) {
      handleError("inline", error);
    }
  }
});

process.on("uncaughtException", error => handleError("uncaught process level", error));
process.on("unhandledRejection", error => handleError("uncaught process level promise", error));
