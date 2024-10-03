import { deployments, ethers } from "hardhat";
import { expect } from "chai";

import { defaultConfiguration } from '../utils';
import { Bridge } from "../../typechain-types";

describe('Test updating relays round configuration', () => {
  let bridge: Bridge;
  
  it('Setup contracts', async () => {
    await deployments.fixture();
  
    bridge = await ethers.getContract('Bridge');
  });

  it('Update relays round configuration by owner', async () => {
    const owner = await ethers.getNamedSigner('owner');
  
    await bridge
      .connect(owner)
      .setConfiguration(defaultConfiguration);
  
    const configuration = await bridge.roundRelaysConfiguration();
  
    expect(configuration.wid)
      .to.be.equal(defaultConfiguration.wid, 'Wrong new configuration wid');
  
    expect(configuration.addr)
      .to.be.equal(defaultConfiguration.addr, 'Wrong new configuration address');
  });
});
