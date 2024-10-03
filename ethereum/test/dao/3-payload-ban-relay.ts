import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";

import {
  encodeDaoActions,
  encodeEverscaleEvent,
  defaultConfiguration,
  sortAccounts,
  signReceipt,
  getInitialRelays
} from '../utils';

import { Bridge, DAO } from "../../typechain-types";

describe('Execute banning relay by DAO', () => {
  let dao: DAO, bridge: Bridge;

  it('Setup contracts', async () => {
    await deployments.fixture();
    
    dao = await ethers.getContract('DAO');
    bridge = await ethers.getContract('Bridge');
  });
  
  it('Setup DAO event configuration', async () => {
    const owner = await ethers.getNamedSigner('owner');

    await dao
      .connect(owner)
      .setConfiguration(defaultConfiguration);
  });
  
  it('Transfer Bridge ownership to DAO', async () => {
    const owner = await ethers.getNamedSigner('owner');
  
    await bridge
      .connect(owner)
      .transferOwnership(await dao.getAddress());
  });
  
  let relayToBeBanned: string;
  
  it('Setup relay to be banned', async () => {
    const {
      stranger
    } = await getNamedAccounts();
  
    relayToBeBanned = stranger;
  });
  
  it('Check relay not banned', async () => {
    expect(await bridge.isBanned(relayToBeBanned))
      .to.be.equal(false, 'Relay should not be banned');
  });
  
  let payload: string, signatures: string[];
  
  it('Execute proposal with banning stranger ', async () => {
    const {
      data: actionData
    } = await bridge.banRelays.populateTransaction([relayToBeBanned]);
    
    const actions = encodeDaoActions([{
      value: 0,
      target: await bridge.getAddress(),
      signature: '',
      data: actionData
    }]);
  
    payload = encodeEverscaleEvent({
      eventData: actions,
      proxy: await dao.getAddress(),
    });
  
    const initialRelays = sortAccounts(await getInitialRelays());
  
    signatures = await Promise.all(initialRelays
      .map(async (account) => signReceipt(payload, account)));
  
    await dao.execute(payload, signatures);
  });
  
  it('Check relay banned', async () => {
    expect(await bridge.isBanned(relayToBeBanned))
      .to.be.equal(true, 'Relay should be banned');
  });
  
  it('Try to reuse payload', async () => {
    await expect(dao.execute(payload, signatures))
      .to.be.revertedWith('Cache: payload already seen');
  });
});
