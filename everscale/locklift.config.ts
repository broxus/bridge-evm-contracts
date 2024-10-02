import "@broxus/locklift-verifier";
import 'dotenv/config';

import { LockliftConfig } from "locklift";
import { FactorySource } from "./build/factorySource";

declare global {
  const locklift: import("locklift").Locklift<FactorySource>;
}

const config: LockliftConfig = {
  verifier: {
    verifierVersion: "latest",
    apiKey: process.env.VERIFIER_API_KEY!,
    secretKey: process.env.VERIFIER_SECRET_KEY!,
  },
  compiler: {
    version: "0.71.0",
    compilerParams: ["--tvm-version", "ton"],
    externalContracts: {
      "../node_modules/@broxus/contracts/contracts/platform": ["Platform"],
    },
  },
  linker: { version: "0.20.6" },
  networks: {
    locklift: {
      giver: {
        address: process.env.LOCAL_GIVER_ADDRESS!,
        key: process.env.LOCAL_GIVER_KEY!,
      },
      connection: {
        id: 1001,
        type: "proxy",
        data: {} as never,
      },
      keys: {
        amount: 20,
      },
    },
    local: {
      connection: {
        id: 1003,
        group: "localnet",
        type: "graphql",
        data: {
          endpoints: [process.env.LOCAL_GRAPHQL_ENDPOINT!],
          local: true,
        },
      },
      giver: {
        address: process.env.LOCAL_GIVER_ADDRESS!,
        key: process.env.LOCAL_GIVER_KEY!,
      },
      keys: {
        amount: 20,
      },
    },
    ton: {
      connection: {
        id: 1002,
        type: "jrpc",
        group: "ton",
        data: {
          endpoint: process.env.TON_JRPC_ENDPOINT!,
        },
      },
      giver: {
        address: process.env.TON_GIVER_ADDRESS!,
        phrase: process.env.TON_GIVER_PHRASE!,
        accountId: 0,
      },
      keys: {
        phrase: process.env.TON_KEYS_PHRASE,
        amount: 20,
      },
    },
  },
  mocha: {
    timeout: 2000000,
  },
};

// noinspection JSUnusedGlobalSymbols
export default config;
