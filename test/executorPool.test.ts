import { ExecutorPool, hashScript } from "../src/executorPool";

const fourtyTwoScript = "module.exports = {main: () => { return 42; }}";
const errorScript = `module.exports = {main: () => { throw new Error("A test error from inside the sandboxed script"); }}`;
const sleepScript = `module.exports = {main: (sleep, shouldError) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldError) {
        reject("test error from inside test harnessed script sleeping for " + sleep);
      } else {
        resolve(sleep);
      }
    }, sleep);
  });
}}`;
const sleepHash = hashScript(sleepScript);

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

test("it catches errors and rejects promises with the error", () => {
  expect.assertions(1);
  return pool.executeScript(errorScript, []).catch(error => {
    expect(error.message).toMatch("sandboxed script");
  });
});

test("it catches async errors and rejects promises with the error", async () => {
  expect.assertions(1);
  await pool.executeScript(sleepScript, [10, true]).catch(error => {
    expect(error.message).toMatch("test harnessed script");
  });
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
  const long = pool.executeHash(sleepHash, [100]);
  const short = pool.executeHash(sleepHash, [15]);
  expect((await short).result).toBe(15);
  expect((await medium).result).toBe(50);
  expect((await long).result).toBe(100);
});

test("stress test: errors don't starve the executor pool", () => {
  const count = 50;
  expect.assertions(count);
  return Promise.all(
    Array.from(Array(count).keys()).map(async i => {
      try {
        await pool.executeScript(sleepScript, [i, true]);
        throw "Executing script did not error";
      } catch (error) {
        expect(error.message).toMatch(`sleeping for ${i}`);
        return true;
      }
    })
  );
});

test("stress test: many scripts with different oucomes at the same time", async () => {
  const count = 100;
  expect.assertions(count);
  await pool.executeScript(sleepScript, [1]);
  const promises = Array.from(Array(count).keys()).map(() => {
    const value = Math.floor(Math.random() * 500);
    const shouldError = value > 300;
    return pool.executeHash(sleepHash, [value, shouldError]).then(
      result => {
        return expect(result.result).toBe(value);
      },
      error => {
        return expect(error.message).toMatch(`sleeping for ${value}`);
      }
    );
  });

  return Promise.all(promises);
}, 10000);
