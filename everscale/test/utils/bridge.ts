import { ed25519_generateKeyPair, Ed25519KeyPair } from "nekoton-wasm";
import { Contract } from "locklift";
import _ from "underscore";
import { Account } from "everscale-standalone-client/nodejs";

import {
  BridgeAbi,
  CellEncoderStandaloneAbi,
  RoundDeployerMockupAbi,
} from "../../build/factorySource";

import { logContract } from "./logger";
import { deployAccount } from "./account";

export const setupRelays = async (amount = 20) => {
  return Promise.all(
    _.range(amount).map(async () => ed25519_generateKeyPair())
  );
};

export const setupBridge = async (
  relays: Ed25519KeyPair[]
): Promise<
  [
    Contract<BridgeAbi>,
    Account,
    Contract<RoundDeployerMockupAbi>,
    Contract<CellEncoderStandaloneAbi>
  ]
> => {
  const signer = (await locklift.keystore.getSigner("0"))!;

  const _randomNonce = locklift.utils.getRandomNonce();

  const owner = await deployAccount(signer, 30);

  await logContract("Owner", owner.address);

  const { contract: roundDeployer } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "RoundDeployerMockup",
      constructorParams: {},
      initParams: {
        _randomNonce,
        __keys: relays.map((r) => `0x${r.publicKey}`),
      },
      publicKey: signer.publicKey,
      value: locklift.utils.toNano(1),
    })
  );

  await logContract("RoundDeployer", roundDeployer.address);

  const connectorData = locklift.factory.getContractArtifacts("Connector");

  const { contract: bridge } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "Bridge",
      constructorParams: {
        _owner: owner.address,
        _manager: owner.address,
        _roundDeployer: roundDeployer.address,
        _connectorCode: connectorData.code,
        _connectorDeployValue: locklift.utils.toNano(1),
      },
      initParams: {
        _randomNonce: locklift.utils.getRandomNonce(),
      },
      publicKey: signer.publicKey,
      value: locklift.utils.toNano(2),
    })
  );

  await logContract("Bridge", bridge.address);

  const { contract: cellEncoder } = await locklift.factory.deployContract({
    contract: "CellEncoderStandalone",
    constructorParams: {},
    initParams: {
      _randomNonce: locklift.utils.getRandomNonce(),
    },
    publicKey: signer?.publicKey as string,
    value: locklift.utils.toNano(1),
  });

  await logContract("CellEncoderStandalone", cellEncoder.address);

  return [bridge, owner, roundDeployer, cellEncoder];
};
