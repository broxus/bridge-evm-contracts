import { deployments, ethers, web3 } from "hardhat";
import { HDNodeWallet } from 'ethers';
import { expect } from "chai";

import {
  defaultConfiguration,
  generateWallets,
  sortAccounts,
  getInitialRelays,
  addressToU160,
  signReceipt,
  encodeTvmEvent
} from '../utils';
import { Bridge } from "../../typechain-types";

describe('Set next round relays', () => {
  let bridge: Bridge;
  
  it('Setup contracts', async () => {
    await deployments.fixture();
    
    bridge = await ethers.getContract('Bridge');
  });
  
  it('Set relays round configuration', async () => {
    const owner = await ethers.getNamedSigner('owner');
    
    await bridge
      .connect(owner)
      .setConfiguration(defaultConfiguration);
  });
  
  let payload: string, signatures: string[], relays: HDNodeWallet[];
  
  it('Send payload & signatures', async () => {
    const initialRelays = sortAccounts(await getInitialRelays());
    
    relays = await generateWallets(initialRelays.length);
    
    // Next round, list of relays, round end timestamp
    const roundRelaysPayload = web3.eth.abi.encodeParameters(
      ['uint32', 'uint160[]', 'uint32'],
      [
        1,
        relays.map(r => addressToU160(r.address)),
        Math.floor(Date.now() / 1000) + 604800 // 1 week
      ]
    );
    
    payload = encodeTvmEvent({
      eventData: roundRelaysPayload,
      proxy: await bridge.getAddress(),
    });
    
    const { requiredSignatures } = await bridge.rounds(0);
  
    signatures = await Promise.all(
      initialRelays
      .slice(0, Number(requiredSignatures))
      .map(async (account) => signReceipt(payload, account))
    );
    
    await bridge.setRoundRelays(payload, signatures);
  });
  
  it('Check new round initialized', async () => {
    expect(await bridge.lastRound())
      .to.be.equal(1, 'Wrong last round');
  });
  
  it('Check relays authorized for new round', async () => {
    for (const relay of relays) {
      expect(await bridge.isRelay(1, relay.address))
        .to.be.equal(true, 'Wrong relay status');
    }
  });
  
  it('Check required signatures for the next round', async () => {
    const { requiredSignatures } = await bridge.rounds(1);
    
    expect(requiredSignatures)
      .to.be.greaterThan(0, 'Too low required signatures')
      .to.be.lessThanOrEqual(relays.length, 'Too high required signatures');
  });
  
  it('Try to reuse payload', async () => {
    await expect(bridge.setRoundRelays(payload, signatures))
      .to.be.revertedWith('Cache: payload already seen');
  });
});
