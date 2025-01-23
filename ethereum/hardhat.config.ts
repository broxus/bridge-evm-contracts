import "dotenv/config";

import "hardhat-dependency-compiler";
import "hardhat-diamond-abi";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-gas-reporter";
import "solidity-coverage";

import "@typechain/hardhat";
import "@primitivefi/hardhat-dodoc";

import "@nomiclabs/hardhat-web3";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";

import { HardhatUserConfig } from "hardhat/config";

const proxyadmin = {
  main: "0x495064d4aaeeF771b9e89B7fD88C94e680F5E9C0",
  bsc: "0x495064d4aaeeF771b9e89B7fD88C94e680F5E9C0",
  avalanche: "0x495064d4aaeeF771b9e89B7fD88C94e680F5E9C0",
};

const multisig = {
  main: "0x495064d4aaeeF771b9e89B7fD88C94e680F5E9C0",
  bsc: "0x495064d4aaeeF771b9e89B7fD88C94e680F5E9C0",
  avalanche: "0x495064d4aaeeF771b9e89B7fD88C94e680F5E9C0",
};

const weth = {
  main: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // https://etherscan.io/token/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
  polygon: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // https://polygonscan.com/token/0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270
  bsc: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // https://bscscan.com/address/0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c
  fantom: "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83", // https://ftmscan.com/token/0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83
  avalanche: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // https://snowtrace.io/token/0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7
};


const bridge = {
  main: '0xe356b80fFF3D253425f8ca030dbfffcf3F1a0ad3',
  bsc: '0xe356b80fFF3D253425f8ca030dbfffcf3F1a0ad3',
  avalanche: '0xe356b80fFF3D253425f8ca030dbfffcf3F1a0ad3'
};

const config: HardhatUserConfig = {
  mocha: { bail: true },
  dependencyCompiler: {
    paths: [
      "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol",
      "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol",
    ],
  },
  diamondAbi: {
    // (required) The name of your Diamond ABI.
    name: "MultiVault",
    // (optional) An array of strings, matched against fully qualified contract names, to
    // determine which contracts are included in your Diamond ABI.
    include: [
      "interfaces/multivault/IMultiVault",
      "interfaces/IDiamondCut",
      "interfaces/IDiamondLoupe",
    ],
    // // (optional) An array of strings, matched against fully qualified contract names, to
    // // determine which contracts are excluded from your Diamond ABI.
    // exclude: ["vendor"],
    // // (optional) A function that is called with the ABI element, index, entire ABI,
    // // and fully qualified contract name for each item in the combined ABIs.
    // // If the function returns `false`, the function is not included in your Diamond ABI.
    filter: function (abiElement, index, fullAbi, fullyQualifiedName) {
      console.log(fullyQualifiedName);
      return true;
    },
    // (optional) Whether exact duplicate sighashes should cause an error to be thrown,
    // defaults to true.
    strict: true,
  },
  dodoc: {
    runOnCompile: true,
    outputDir: "./../docs/evm-specification",
    include: [
      "bridge/Bridge.sol",
      "vault/Vault.sol",
      "DAO.sol",
      "multivault/MultiVault.sol",
    ],
    freshOutput: true,
    keepFileStructure: false,
  },
  abiExporter: {
    path: "abi",
    clear: true,
    flat: true,
    spacing: 2,
    runOnCompile: true,
    only: [
      ":Vault$",
      ":Bridge$",
      ":DAO$",
      ":MultiVaultFacet",
      ":Diamond",
      ":StakingRelayVerifier",
    ],
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [":VaultFacet", ":MultiVaultFacet"],
  },
  solidity: {
    compilers: [
      {
        version: "0.8.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: `paris`,
        },
      },
      {
        version: "0.8.2",
        settings: {
          optimizer: {
            enabled: true,
            runs: 0,
          },
        },
      },
    ],
  },
  deterministicDeployment: {
    "1": {
      factory: "0xcD04370a052CC2EeA4feC3f96Dc5D5c6e2129c69",
      deployer: "0xdD54d5Fca0Df238f92A0421B31Ca766A20f70F6d",
      funding: "10000000000000000",
      signedTx:
        "0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf326a06be8767d0148bd0b97867a6ef2e7eb5c64f5924e9d1abaadf308caf65a590f28a01cf563db1c904a068702a0aa859f610706c928be59dec07eb86730a132c7ea82",
    },
    "56": {
      factory: "0xcD04370a052CC2EeA4feC3f96Dc5D5c6e2129c69",
      deployer: "0xdD54d5Fca0Df238f92A0421B31Ca766A20f70F6d",
      funding: "500000000000000",
      signedTx:
        "0xf8a68085012a05f200830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf38194a0cf5862bba33f3ce680f9a8070a11c45899b300bacafdfb193784fc64ceba79d8a062c53832b83e65d8488186d6d6b508e8793658a06912c8b4ba3ac98a8eb28217",
    },
    "137": {
      factory: "0xcD04370a052CC2EeA4feC3f96Dc5D5c6e2129c69",
      deployer: "0xdD54d5Fca0Df238f92A0421B31Ca766A20f70F6d",
      funding: "20000000000000000",
      signedTx:
        "0xf8a780852e90edd000830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3820136a05f4e192f944f4d708e916a7ad829c348eaa5a8b5413ea8dfe2d4d98d5b030141a04809c69bfcc5e0876adad0d5cdad928ea41d24b26ae9dfa159a75ed217e6fe90",
    },
    "250": {
      factory: "0xcD04370a052CC2EeA4feC3f96Dc5D5c6e2129c69",
      deployer: "0xdD54d5Fca0Df238f92A0421B31Ca766A20f70F6d",
      funding: "50000000000000000",
      signedTx:
        "0xf8a78085746a528800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3820217a06c337d22bed572141f530759e3d6390be456630218a5084f7fd06e9f0734a8e1a00c474f88289644b0f4bfd7c6bde7b55e043027ee03e4cd65a533a756698c2d33",
    },
    "8217": {
      factory: "0xcD04370a052CC2EeA4feC3f96Dc5D5c6e2129c69",
      deployer: "0xdD54d5Fca0Df238f92A0421B31Ca766A20f70F6d",
      funding: "10000000000000000",
      signedTx:
        "0xf8a78085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3824055a0c9b7e3d1a99ca583fd143455ce3db324f4559abe54d912e87cd20e9389074f58a07fec9c5f9bebb7d9e7cf6ea9910302f32647174987ef4be7efede0fdbadd6683",
    },
    "43114": {
      factory: "0xcD04370a052CC2EeA4feC3f96Dc5D5c6e2129c69",
      deployer: "0xdD54d5Fca0Df238f92A0421B31Ca766A20f70F6d",
      funding: "10000000000000000",
      signedTx:
        "0xf8a88085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3830150f7a027fe3b05132ecdd5b50e78b3bae1113c34c6222e01bf8e1aeb9500ee7f30d93fa01c38ee4f899bd4e729d716828dbb5a378ecce845f36f2af52edfcba632519b6d",
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: 1111,
      accounts: {
        count: 50,
      },
    },
    main: {
      url: process.env.ETHEREUM_RPC_URL,
      gasPrice: 10000000000, // 10 gwei
      gas: 3000000,
      timeout: 1000000,
      accounts: {
        mnemonic: process.env.ETH_MNEMONIC,
        count: 50,
      },
    },
    bsc: {
      url: process.env.BSC_RPC_URL,
      gasPrice: 1500000000, // 1.5 gwei
      gas: 3000000,
      timeout: 1000000,
      accounts: {
        mnemonic: process.env.ETH_MNEMONIC,
        count: 50,
      },
    },
    avalanche: {
      url: process.env.AVALANCHE_RPC_URL,
      gasPrice: 3500000000, // 3.5 gwei
      gas: 3000000,
      timeout: 1000000,
      accounts: {
        mnemonic: process.env.ETH_MNEMONIC,
        count: 50,
      },
    },
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 100,
    enabled: true,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    outputFile: "gas-report.txt",
    noColors: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY,
  },
  namedAccounts: {
    multisig: {
      ...multisig,
    },
    deployer: {
      ...multisig,
    },
    guardian: {
      ...multisig,
    },
    management: {
      ...multisig,
    },
    bridge: {
      default: "0x0000000000000000000000000000000000000000",
      ...bridge,
    },
    proxyadmin: {
      default: "0x0000000000000000000000000000000000000000",
      ...proxyadmin,
    },
    owner: {
      ...multisig,
    },
    weth: {
      default: weth.main,
      ...weth,
    },
    alice: {
      default: 4,
    },
    bob: {
      default: 5,
    },
    eve: {
      default: 6,
    },
    stranger: {
      default: 7,
    },
    roundSubmitter: {
      ...multisig,
    },
    multivault: {
      default: "0x0000000000000000000000000000000000000000",
      main: "0x457ce30424229411097262c2A3A7f6Bc58BDf284",
      bsc: "0x457ce30424229411097262c2A3A7f6Bc58BDf284",
      avalanche: "0x457ce30424229411097262c2A3A7f6Bc58BDf284",
    },
    relay_1: {
      main: "0x7f96d32f752507b03d48baad1dee0fc92b6373d8",
      bsc: "0x7f96d32f752507b03d48baad1dee0fc92b6373d8",
      avalanche: "0x7f96d32f752507b03d48baad1dee0fc92b6373d8",
    },
    relay_2: {
      main: "0xf3abcaf556d2a63c70039ff45670544bd28e6056",
      bsc: "0xf3abcaf556d2a63c70039ff45670544bd28e6056",
      avalanche: "0xf3abcaf556d2a63c70039ff45670544bd28e6056",
    },
    relay_3: {
      main: "0xbf26930e84b6378eb6938b4b6018ea67d608ae5f",
      bsc: "0xbf26930e84b6378eb6938b4b6018ea67d608ae5f",
      avalanche: "0xbf26930e84b6378eb6938b4b6018ea67d608ae5f",
    },
    withdrawGuardian: {
      ...multisig,
    },
    gasDonor: {
      ...multisig,
    },
  },
};

// noinspection JSUnusedGlobalSymbols
export default config;
