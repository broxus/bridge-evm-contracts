import { deployments, ethers } from "hardhat";
import { expect } from "chai";

import {
  defaultConfiguration,
  encodeDaoActions,
  defaultChainId,
  encodeEverscaleEvent,
  sortAccounts,
  getInitialRelays,
  signReceipt
} from '../utils';
import { DAO } from "../../typechain-types";

describe('Use payload with wrong chain id', () => {
  let dao: DAO, payload: string, signatures: string[];
  
  it('Setup contracts', async () => {
    await deployments.fixture();
    
    dao = await ethers.getContract('DAO');
  });
  
  it('Set DAO configuration', async () => {
    const owner = await ethers.getNamedSigner('owner');

    await dao
      .connect(owner)
      .setConfiguration(defaultConfiguration);
  });
  
  it('Prepare payload & signatures with wrong chain id', async () => {
    const actions = encodeDaoActions([{
      target: await dao.getAddress(),
      data: '0x'
    }], defaultChainId + 1);
  
    payload = encodeEverscaleEvent({
      eventData: actions,
      proxy: await dao.getAddress(),
    });

    const initialRelays = sortAccounts(await getInitialRelays());

    signatures = await Promise.all(initialRelays
      .map(async (account) => signReceipt(payload, account)));
  });
  
  it('Execute', async () => {
    await expect(dao.execute(payload, signatures))
      .to.be.revertedWith('DAO: wrong chain id');
  });
});
