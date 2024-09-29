import { Contract } from "locklift";
import { Account } from "everscale-standalone-client/nodejs";

import {
  MediatorAbi,
  ProxyMultiVaultNativeJettonAbi,
} from "../../build/factorySource";

export const setupHiddenBridge = async (
  owner: Account,
  nativeProxy: Contract<ProxyMultiVaultNativeJettonAbi>
): Promise<[Contract<MediatorAbi>]> => {
  const signer = (await locklift.keystore.getSigner("0"))!;

  const { contract: mediator } = await locklift.factory.deployContract({
    contract: "Mediator",
    constructorParams: {
      _owner: owner.address,
      _nativeProxy: nativeProxy.address,
    },
    initParams: {
      _randomNonce: locklift.utils.getRandomNonce(),
    },
    publicKey: signer.publicKey,
    value: locklift.utils.toNano(15),
  });

  return [mediator];
};

export enum MediatorOperation {
  BurnToAlienProxy,
  BurnToMergePool,
  TransferToNativeProxy,
}
