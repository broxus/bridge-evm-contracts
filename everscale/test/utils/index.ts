export const isValidTonAddress = (address: string) =>
  /^(?:-1|0):[0-9a-fA-F]{64}$/.test(address);
