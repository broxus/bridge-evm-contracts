import ethers from "ethers";
import { BigNumber } from "bignumber.js";
import fs from "fs";
import { Address } from "locklift";

const requireEnv = <T>(name: string, _default?: T): string | T => {
  const value = process.env[name];

  if (value === undefined && _default === undefined) {
    throw new Error(`Missing env at ${name}`);
  }

  if (_default === undefined || _default == null) {
    throw new Error(`Missing default value for ${name}`);
  }

  return value || _default;
};

const main = async () => {
  const rpc = requireEnv<string>("EVM_RPC");
  const bridgeAddress = requireEnv<string>("EVM_BRIDGE");
  const configuration = requireEnv<string>("ROUND_RELAYS_CONFIGURATION");
  const seed = requireEnv<string>(
    "EVM_SEED",
    "body force exact angry main news train capital kitten bronze skirt stock"
  );
  // const cellEncoderAddress = requireEnv("CELL_ENCODER");
  const targetGasPrice = ethers.utils.parseUnits(
    requireEnv("TARGET_GAS_PRICE"),
    9
  );

  console.log("Starting rounds uploading");

  // Connect to the Ethereum
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const bridge = new ethers.Contract(
    bridgeAddress,
    JSON.parse(fs.readFileSync("./../ethereum/abi/Bridge.json").toString()),
    provider
  );
  const submitter = ethers.Wallet.fromMnemonic(seed).connect(provider);

  const lastRound = await bridge.lastRound();
  console.log(`Last round in Ethereum bridge: ${lastRound}`);

  const roundRelaysConfiguration = locklift.factory.getDeployedContract(
    "EverscaleEthereumEventConfiguration",
    new Address(configuration)
  );
  // const cellEncoderStandalone = locklift.factory.getDeployedContract(
  //   "CellEncoderStandalone",
  //   cellEncoderAddress
  // );

  // Get event configuration details
  const roundRelaysConfigurationDetails = await roundRelaysConfiguration.methods
    .getDetails({ answerId: 0 })
    .call();

  // Get events from the configuration
  const events = await roundRelaysConfiguration
    .getPastEvents({ filter: "NewEventContract" })
    .then((e) => e.events);

  console.log(`Found ${events.length} events`);

  const eventDetails = await Promise.all(
    events.map(async (event) => {
      const roundTonEvent = locklift.factory.getDeployedContract(
        "RoundEverscaleEthereumEvent",
        event.data.eventContract
      );
      const decodedData = await roundTonEvent.methods
        .getDecodedData({ answerId: 0 })
        .call();
      const details = await roundTonEvent.methods
        .getDetails({ answerId: 0 })
        .call();

      const eventDataEncoded = ethers.utils.defaultAbiCoder.encode(
        ["uint32", "uint160[]", "uint32"],
        [
          decodedData.round_num.toString(),
          decodedData.eth_keys,
          decodedData.round_end.toString(),
        ]
      );

      const { round_number: roundNumber } = await roundTonEvent.methods
        .round_number()
        .call();

      const encodedEvent = ethers.utils.defaultAbiCoder.encode(
        [
          `tuple(
                  uint64 eventTransactionLt,
                  uint32 eventTimestamp,
                  bytes eventData,
                  int8 configurationWid,
                  uint256 configurationAddress,
                  int8 eventContractWid,
                  uint256 eventContractAddress,
                  address proxy,
                  uint32 round
                )`,
        ],
        [
          {
            eventTransactionLt:
              details._eventInitData.voteData.eventTransactionLt.toString(),
            eventTimestamp:
              details._eventInitData.voteData.eventTimestamp.toString(),
            eventData: eventDataEncoded,

            configurationWid: roundRelaysConfiguration.address
              .toString()
              .split(":")[0],
            configurationAddress:
              "0x" + roundRelaysConfiguration.address.toString().split(":")[1],

            eventContractWid: event.data.eventContract.toString().split(":")[0],
            eventContractAddress:
              "0x" + event.data.eventContract.toString().split(":")[1],

            proxy: `0x${new BigNumber(
              roundRelaysConfigurationDetails._networkConfiguration.proxy
            ).toString(16)}`,
            round: roundNumber.toString(),
          },
        ]
      );
      const signatures = await Promise.all(
        details._signatures.map(async (sign) => {
          return {
            sign,
            address: ethers.BigNumber.from(
              await bridge.recoverSignature(
                encodedEvent,
                Buffer.from(sign, "base64")
              )
            ),
          };
        })
      );

      signatures.sort((a, b) => {
        if (a.address.eq(b.address)) {
          return 0;
        }
        if (a.address.gt(b.address)) {
          return 1;
        } else {
          return -1;
        }
      });

      return {
        ...details,
        roundNumber,
        encodedEvent,
        eventData: decodedData,
        eventContract: event.data.eventContract.toString(),
        signatures: signatures.map(
          (d) => "0x" + Buffer.from(d.sign, "base64").toString("hex")
        ),
        created_at: event.transaction.createdAt,
      };
    })
  );

  console.log(`Event decoded`);

  for (const event of eventDetails.sort((a, b) =>
    a.roundNumber < b.roundNumber ? -1 : 1
  )) {
    console.log(`Processing event #${event.eventData.round_num}`);
    console.log(`Event address: ${event.eventContract}`);
    console.log(`Payload: ${event.encodedEvent}`);
    console.log(`Signatures: [${event.signatures.join(",")}]`);

    if (event.eventData.round_num > lastRound) {
      console.log(`Submitting round`);

      console.log(`Submitter: ${submitter.address}`);
      console.log(
        `Balance: ${ethers.utils.formatUnits(
          await provider.getBalance(submitter.address),
          18
        )}`
      );

      const gasPrice = await provider.getGasPrice();
      console.log(`Gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")}`);
      console.log(
        `Target gas price: ${ethers.utils.formatUnits(targetGasPrice, "gwei")}`
      );

      // Check submitter don't have any pending transactions
      const pendingCount = await provider.getTransactionCount(
        submitter.address,
        "pending"
      );
      const confirmedCount = await provider.getTransactionCount(
        submitter.address,
        "latest"
      );

      console.log(
        `Submitter transactions count: pending - ${pendingCount}, confirmed - ${confirmedCount}`
      );

      if (pendingCount > confirmedCount) {
        console.error(`Submitter has pending transactions, exit`);
        process.exit(1);
      }

      const tx = await bridge
        .connect(submitter)
        .setRoundRelays(event.encodedEvent, event.signatures, {
          gasPrice: targetGasPrice.gt(gasPrice) ? gasPrice : targetGasPrice, // Use min gas price possible
        });

      console.log(`Transaction: ${tx.hash}`);

      process.exit(0);
    } else {
      console.log(`Round already uploaded, skipping`);
    }

    console.log("");
  }
};

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
