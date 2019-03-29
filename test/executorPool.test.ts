import { ExecutorPool, hashScript } from "../src/executorPool";

const fourtyTwoScript = "module.exports = {main: () => { return 42; }}";
const sleepScript = `module.exports = {main: (sleep) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(sleep), sleep);
  });
}}`;

let pool: ExecutorPool;

beforeEach(() => {
  pool = new ExecutorPool();
});

afterEach(async () => {
  await pool.drain();
});

test("it executes a script", async () => {
  const result = await pool.executeScript(fourtyTwoScript, []);
  expect(result.result).toBe(42);
});

test("it executes an async script", async () => {
  const result = await pool.executeScript(sleepScript, [10]);
  expect(result.result).toBe(10);
});

test("it throws if asked to execute a hash it hasn't executed before", async () => {
  await expect(pool.executeHash("foobar", [])).rejects.toThrow("not found");
});

test("it executes a script by hash if it has executed it before", async () => {
  await pool.executeScript(fourtyTwoScript, []);
  const result = await pool.executeHash(hashScript(fourtyTwoScript), []);
  expect(result.result).toBe(42);
});

test("it executes multiple scripts at the same time", async () => {
  const medium = pool.executeScript(sleepScript, [50]);
  const long = pool.executeHash(hashScript(sleepScript), [100]);
  const short = pool.executeHash(hashScript(sleepScript), [15]);
  expect((await short).result).toBe(15);
  expect((await medium).result).toBe(50);
  expect((await long).result).toBe(100);
});
