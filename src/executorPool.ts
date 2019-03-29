import LRU from "lru-cache";
import genericPool from "generic-pool";
import { Executor } from "./executor";
import xxhash from "xxhash";

export const hashScript = (script: string) => xxhash.hash(Buffer.from(script, "utf8"), 0xcafebabe);
export class HashNotFoundError extends Error {}

export class ExecutorPool {
  perScriptPoolCache: LRU<string, genericPool.Pool<Executor>>;

  constructor() {
    this.perScriptPoolCache = new LRU({
      max: 50,
      dispose: (key, value) => {
        value.drain();
      }
    });
  }

  async executeHash(hash: string, args: any) {
    const pool = this.perScriptPoolCache.get(hash);
    if (!pool) {
      throw new HashNotFoundError(`Hash ${hash} not found in executors`);
    }

    return this.executeUsingPool(pool, args);
  }

  async executeScript(script: string, args: any) {
    const hash = hashScript(script);
    let pool = this.perScriptPoolCache.get(hash);
    if (!pool) {
      pool = genericPool.createPool(
        {
          create() {
            return Promise.resolve(new Executor(hash, script));
          },
          destroy(executor) {
            return Promise.resolve(executor.kill("draining parent pool"));
          },
          validate(executor) {
            return Promise.resolve(executor.ready);
          }
        },
        {
          max: 10,
          min: 0,
          testOnBorrow: true
        }
      );
      this.perScriptPoolCache.set(hash, pool);
    }

    return this.executeUsingPool(pool, args);
  }

  async drain() {
    return await Promise.all(this.perScriptPoolCache.values().map(pool => pool.drain().then(() => pool.clear())));
  }

  private async executeUsingPool(pool: genericPool.Pool<Executor>, args: any) {
    const executor = await pool.acquire();
    return executor.execute(args).finally(() => pool.release(executor));
  }
}
