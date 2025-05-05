import { deployments, ethers, web3 } from "hardhat";
import { expect } from "chai";

import {
  defaultConfiguration,
  generateWallets,
  addressToU160,
  encodeTvmEvent,
  getInitialRelays,
  sortAccounts,
  signReceipt
} from '../utils';
import { Bridge } from "../../typechain-types";

describe('Try to set next round relays with too few signatures', () => {
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
    const minimumRequiredSignatures = await bridge.minimumRequiredSignatures();
    
    const relays = await generateWallets(Number(minimumRequiredSignatures) * 2);
    
    // Next round, list of relays, round end timestamp
    const roundRelaysPayload = web3.eth.abi.encodeParameters(
      ['uint32', 'uint160[]', 'uint32'],
      [
        1,
        relays.map(r => addressToU160(r.address)),
        Math.floor(Date.now() / 1000) + 604800 // 1 week
      ]
    );
    
    const payload = encodeTvmEvent({
      eventData: roundRelaysPayload,
      proxy: await bridge.getAddress(),
    });
    
    const initialRelays = sortAccounts(await getInitialRelays());
  
    const { requiredSignatures } = await bridge.rounds(0);
    
    const signatures = await Promise.all(
      initialRelays
      .slice(0, Number(requiredSignatures) - 1) // dev: 1 signature less than required
      .map(async (account) => signReceipt(payload, account))
    );
    
    await expect(bridge.setRoundRelays(payload, signatures))
      .to.be.revertedWith("Bridge: signatures verification failed");
  });
});
