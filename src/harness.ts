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

const formatException = (e: any) => {
  if (e.message) {
    return `${e.message}\n${e.stack}`;
  } else {
    return String(e);
  }
};

const logger = (level: string) => {
  return (...args: any[]) => {
    console.error(level + ":", ...args);
  };
};

const newVM = () => {
  const vm = new NodeVM({
    console: "redirect",
    sandbox: { module: {} }
  });
  ["debug", "log", "info", "warn", "error"].forEach(level => {
    vm.on(`console.${level}`, logger(level));
  });
  return vm;
};

rl.on("line", async (line: string) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch (e) {
    console.error("=== JSON parsing error", e);
    process.exit(1);
  }

  if (!setup) {
    // Define the execute script from the first message, and execute it with each future argument
    script = new VMScript(message.script);
    setup = true;
  } else {
    console.error(`=== executing ${JSON.stringify(message)}`);
    try {
      const vm = newVM();
      const module = vm.run(script);
      const result = await Promise.resolve(module.main.apply(undefined, message.args));
      console.log(JSON.stringify({ complete: true, result }));
    } catch (e) {
      console.error(`=== error executing script, exception follows\n${formatException(e)}`);
      console.log(JSON.stringify({ error: true, errorMessage: formatException(e) }));
    }
  }
});

process.on("uncaughtException", e => {
  console.error(`=== async error executing script, exception follows\n${formatException(e)}`);
  console.log(JSON.stringify({ error: true, errorMessage: formatException(e) }));
});
