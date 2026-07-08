/// <reference path="../../node_modules/@cloudflare/vitest-pool-workers/types/cloudflare-test.d.ts" />

import type { D1Migration } from "cloudflare:test";

declare module "cloudflare:workers" {
  const env: Cloudflare.Env;
  export { env };
}

declare module "vitest" {
  interface ProvidedContext {
    migrations: D1Migration[];
  }
}
