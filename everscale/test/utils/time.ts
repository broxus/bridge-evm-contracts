export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function tryIncreaseTime(ms: number) {
  if (locklift.testing.isEnabled) {
    await locklift.testing.increaseTime(ms / 1000);
  } else {
    await sleep(ms);
  }
}
