import { Address } from "locklift";

export const logContract = async (name: string, address: Address) => {
  const balance = await locklift.provider.getBalance(address);

  console.log(`${name} (${address}) - ${locklift.utils.fromNano(balance)}`);
};
