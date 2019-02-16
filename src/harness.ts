// JS file executed as a subprocess of the main one to actually do the work
// It does this:
// - boot and define the execution environment
// - read in the JS to execute
// - drops priviledges using seccomp
// - executes the untrusted script to define the main function
// - blocks on reading new messages in to execute using the main function
const readline = require("readline");
let setup = false;
let execute: any;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", (line: string) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch (e) {
    console.error("=== JSON parsing error", e);
    process.exit(1);
  }

  if (!setup) {
    // Define the execute script from the first message, and execute it with each future argument
    execute = eval(message.script);
    setup = true;
  } else {
    console.error(`== executing ${JSON.stringify(message)}`);
    try {
      const result = execute(...message.args);
      console.log(JSON.stringify({ complete: true, result }));
    } catch (e) {
      console.error(`=== error executing script ${e}`);
    }
  }
});
