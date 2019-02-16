import LRU from "lru-cache";
import { Executor } from "./executor";
import xxhash from "xxhash";

export const hashScript = (script: string) => xxhash.hash(Buffer.from(script, "utf8"), 0xcafebabe);

export class ExecutorPool {
  pool: LRU.Cache<string, Executor>;

  constructor() {
    this.pool = new LRU({
      max: 500,
      dispose: (key, value) => {
        value.kill();
      }
    });
  }

  forHash(hash: string) {
    let executor = this.pool.get(hash);

    // Reboot dead executors if they are still in the pool
    if (executor && !executor.ready) {
      executor = new Executor(hash, executor.script);
      this.pool.set(hash, executor);
    }

    return executor;
  }

  forScript(script: string) {
    const hash = hashScript(script);
    let executor = this.forHash(hash);
    if (!executor) {
      executor = new Executor(hash, script);
      this.pool.set(hash, executor);
    }
    return executor;
  }
}
