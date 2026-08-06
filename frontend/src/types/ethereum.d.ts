interface EthereumRequestArguments {
  method: string;
  params?: unknown[] | object;
}

interface EthereumProvider {
  request(
    arguments: EthereumRequestArguments
  ): Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};