import { deployments, ethers, web3 } from "hardhat";
import { expect } from "chai";

import {
  defaultConfiguration,
  generateWallets,
  encodeEverscaleEvent,
  addressToU160,
  sortAccounts,
  getInitialRelays,
  signReceipt
} from '../utils';
import { Bridge } from "../../typechain-types";

describe('Try to set too few relays for the next round', () => {
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
  
  it('Send payload & signatures', async () => {
    const relays = await generateWallets(1);
    
    // Next round, list of relays, round end timestamp
    const roundRelaysPayload = web3.eth.abi.encodeParameters(
      ['uint32', 'uint160[]', 'uint32'],
      [
        1,
        relays.map(r => addressToU160(r.address)),
        Math.floor(Date.now() / 1000) + 604800 // 1 week
      ]
    );
    
    const payload = encodeEverscaleEvent({
      eventData: roundRelaysPayload,
      proxy: await bridge.getAddress(),
    });
    
    const initialRelays = sortAccounts(await getInitialRelays());
  
    const { requiredSignatures } = await bridge.rounds(0);
  
    const signatures = await Promise.all(
      initialRelays
      .slice(0, Number(requiredSignatures))
      .map(async (account) => signReceipt(payload, account))
    );
    
    await bridge.setRoundRelays(payload, signatures);
  });
  
  it('Check new round required signatures same as minimum', async () => {
    const minimumRequiredSignatures = await bridge.minimumRequiredSignatures();
    
    const {
      requiredSignatures
    } = await bridge.rounds(1);
    
    expect(requiredSignatures)
      .to.be.equal(minimumRequiredSignatures, 'Wrong required signatures for the new round');
  });
});
