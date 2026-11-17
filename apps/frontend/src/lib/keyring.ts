let current: CryptoKey | null = null;

export const keyring = {
  set(key: CryptoKey): void {
    current = key;
  },
  get(): CryptoKey | null {
    return current;
  },
  clear(): void {
    current = null;
  },
};
