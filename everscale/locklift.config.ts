import "@broxus/locklift-verifier";
import 'dotenv/config';

import { LockliftConfig } from "locklift";
import { FactorySource } from "./build/factorySource";

declare global {
  const locklift: import("locklift").Locklift<FactorySource>;
}

const config: LockliftConfig = {
  compiler: {
    version: "0.71.0",
    compilerParams: ["--tvm-version", "ton"],
    externalContracts: {
      "node_modules/@broxus/contracts/contracts/platform": ["Platform"],
    },
  },
  linker: { version: "0.20.6" },
  verifier: {
    verifierVersion: 'latest',
    apiKey: process.env.EVERSCAN_API_KEY!,
    secretKey: process.env.EVERSCAN_SECRET_KEY!,
  },
  networks: {
    locklift: {
      giver: {
        address: '0:ece57bcc6c530283becbbd8a3b24d3c5987cdddc3c8b7b33be6e4a6312490415',
        key: '172af540e43a524763dd53b26a066d472a97c4de37d5498170564510608250c3',
      },
      connection: {
        id: 1001,
        type: "proxy",
        // @ts-ignore
        data: {}
      },
      keys: {
        phrase: 'action inject penalty envelope rabbit element slim tornado dinner pizza off blood',
        amount: 20,
      },
    },

    ton: {
      connection: {
        id: 1002,
        type: "jrpc",
        group: "ton",
        data: {
          endpoint: process.env.TON_MAINNET_NETWORK_ENDPOINT!,
        },
      },
      giver: {
        address: process.env.TON_MAINNET_GIVER_ADDRESS!,
        phrase: process.env.TON_MAINNET_GIVER_PHRASE!,
        accountId: 0,
      },
      keys: {
        phrase: process.env.TON_MAINNET_PHRASE!,
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
