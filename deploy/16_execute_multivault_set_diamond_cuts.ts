import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import _ from "lodash";

import { MultiVaultFacetSettings } from "../typechain-types";

const deterministicDeployment = "chainconnect-ton-prod";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deployer, weth, bridge: bridge_, owner } = await getNamedAccounts();

  // Set up diamond cuts
  // Initialize settings facet
  const facets = [
    "MultiVaultFacetDeposit",
    "MultiVaultFacetFees",
    "MultiVaultFacetPendingWithdrawals",
    "MultiVaultFacetSettings",
    "MultiVaultFacetTokens",
    "MultiVaultFacetWithdraw",
    "MultiVaultFacetLiquidity",
    "MultiVaultFacetTokenFactory",
  ];

  // Deploy every facet
  for (const facet of facets) {
    await deployments.deploy(facet, {
      from: deployer,
      log: true,
      deterministicDeployment: ethers.encodeBytes32String(
        deterministicDeployment,
      ),
    });
  }

  const facetCuts = await Promise.all(
    facets.map(async (name) => {
      const facet = await ethers.getContract(name);

      const functionSelectors: string[] = [];

      facet.interface.forEachFunction((func) => {
        console.log(name, func.name, func.selector);

        functionSelectors.push(func.selector);
      });

      return {
        facetAddress: await facet.getAddress(),
        action: 0,
        functionSelectors,
      };
    }),
  );

  console.log(`Cuts: ${JSON.stringify(facetCuts)}`);

  // Merge ABIs
  const diamondABI = [];
  const allFacets = [
    ...facets,
    "DiamondCutFacet",
    "DiamondLoupeFacet",
    "DiamondOwnershipFacet",
  ];

  for (const name of allFacets) {
    const facet = await deployments.getExtendedArtifact(name);
    diamondABI.push(...facet.abi);
  }

  const proxy = await deployments.get("MultiVaultProxy");

  await deployments.save("MultiVault", {
    abi: _.uniqWith(diamondABI, _.isEqual),
    address: proxy.address,
  });

  // Initialize multivault
  // - Get bridge address
  let bridge_address;

  if (bridge_ === ethers.ZeroAddress) {
    const bridge = await deployments.get("Bridge");

    bridge_address = bridge.address;
  } else {
    bridge_address = bridge_;
  }

  const settings = await ethers.getContract<MultiVaultFacetSettings>(
    "MultiVaultFacetSettings",
  );

  const { data: multiVaultInitialize } =
    await settings.initialize.populateTransaction(bridge_address, owner, weth);

  await deployments.execute(
    "MultiVault",
    {
      from: deployer,
      log: true,
    },
    "diamondCut",
    facetCuts,
    await settings.getAddress(),
    multiVaultInitialize,
  );
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Deploy_MultiVault_Set_Diamond_Cuts"];
