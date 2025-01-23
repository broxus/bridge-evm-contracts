import { Address, getRandomNonce, toNano } from "locklift";

const main = async () => {
  const key =
    "0x98d55b252538ad1b3d29576759cb015b4a505bbc2967f9fe537fcf669e69fc5c";
  const owner =
    "0:22128f17fef7a538d4a92152db86c4b70f4dd1137ae162d38939a36b724e681b";

  const EventCloser = locklift.factory.getContractArtifacts("EventCloser");
  const EventDeployer = locklift.factory.getContractArtifacts("EventDeployer");

  const signer = (await locklift.keystore.getSigner("0"))!;

  const { contract } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "EventCreditFactory",
      constructorParams: {
        owner_: new Address(owner),
        key_: key,
        eventCloserCode_: EventCloser.code,
        eventDeployerCode_: EventDeployer.code,
        eventClosersCount: 1,
        eventDeployersCount: 1,
      },
      initParams: { _randomNonce: getRandomNonce() },
      publicKey: signer.publicKey,
      value: toNano(5),
    })
  );

  console.log(`Event credit factory: ${contract.address}`);
};

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
