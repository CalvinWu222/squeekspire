/** Wallet access is limited to account selection, reading the chain, and an explicit network switch. */
export const SEPOLIA_CHAIN_ID = '0xaa36a7';

export type WalletProviderListener = (...args: unknown[]) => void;

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: 'accountsChanged' | 'chainChanged', listener: WalletProviderListener): unknown;
  removeListener?(event: 'accountsChanged' | 'chainChanged', listener: WalletProviderListener): unknown;
}

export interface WalletState {
  address: string | null;
  chainId: string | null;
  pending: boolean;
  message: string;
}

export function isWalletAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);
}

export function shortenAddress(address: string): string {
  return isWalletAddress(address) ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

function chainId(value: unknown): string | null {
  return typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value)
    ? `0x${BigInt(value).toString(16)}` : null;
}

function firstAddress(value: unknown): string | null {
  return Array.isArray(value) && isWalletAddress(value[0]) ? value[0] : null;
}

function connectedMessage(chain: string | null): string {
  return chain === SEPOLIA_CHAIN_ID ? 'Connected to Sepolia.'
    : chain ? 'Wallet connected. You can switch to Sepolia.'
      : 'Wallet connected. Network unavailable; you can switch to Sepolia.';
}

function requestError(error: unknown, switching: boolean): string {
  const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 4001) return switching ? 'Network switch canceled.' : 'Wallet connection canceled. Guest play is still available.';
  if (code === -32002) return 'A wallet request is already open. Check your wallet.';
  if (switching && code === 4902) return 'Sepolia is unavailable in your wallet. Add Sepolia in your wallet, then try again.';
  return switching ? 'Unable to switch networks. Try again in your wallet.'
    : 'Unable to connect wallet. Guest play is still available.';
}

export class WalletController {
  private snapshot: WalletState = { address: null, chainId: null, pending: false, message: '' };
  private readonly listeners = new Set<(state: WalletState) => void>();
  private provider: Eip1193Provider | undefined;
  private providerListeners: Array<['accountsChanged' | 'chainChanged', WalletProviderListener]> = [];
  private binding = 0;
  private operation = 0;
  private accountsRevision = 0;
  private chainRevision = 0;
  private disposed = false;

  constructor(private readonly getProvider: () => Eip1193Provider | undefined) {}

  get state(): WalletState { return { ...this.snapshot }; }

  subscribe(listener: (state: WalletState) => void): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }

  private update(changes: Partial<WalletState>): void {
    this.snapshot = { ...this.snapshot, ...changes };
    for (const listener of this.listeners) listener(this.state);
  }

  private detachProvider(): void {
    this.binding++;
    for (const [event, listener] of this.providerListeners) {
      try { this.provider?.removeListener?.(event, listener); }
      catch { /* Local disconnection still works if a provider cannot remove listeners. */ }
    }
    this.providerListeners = [];
    this.provider = undefined;
  }

  private attachProvider(provider: Eip1193Provider): void {
    this.detachProvider();
    this.provider = provider;
    const binding = this.binding;
    const active = () => !this.disposed && this.binding === binding;
    const accountsChanged: WalletProviderListener = accounts => {
      if (!active()) return;
      this.accountsRevision++;
      const address = firstAddress(accounts);
      if (!address) {
        this.disconnect();
        return;
      }
      this.update({ address, message: connectedMessage(this.snapshot.chainId) });
    };
    const chainChanged: WalletProviderListener = chain => {
      if (!active()) return;
      this.chainRevision++;
      const nextChain = chainId(chain);
      this.update({ chainId: nextChain, message: this.snapshot.address ? connectedMessage(nextChain) : this.snapshot.message });
    };
    this.providerListeners = [['accountsChanged', accountsChanged], ['chainChanged', chainChanged]];
    for (const [event, listener] of this.providerListeners) {
      try { provider.on?.(event, listener); }
      catch { /* Providers without event support can still connect and switch explicitly. */ }
    }
  }

  async connect(): Promise<void> {
    if (this.disposed || this.snapshot.pending) return;
    let provider: Eip1193Provider | undefined;
    try { provider = this.getProvider(); }
    catch { /* A restricted provider getter behaves like an unavailable wallet. */ }
    if (!provider || typeof provider.request !== 'function') {
      this.update({ message: 'No Ethereum wallet found. Install a wallet extension or keep playing as a guest.' });
      return;
    }
    this.attachProvider(provider);
    const operation = ++this.operation;
    const accountsRevision = this.accountsRevision;
    this.update({ pending: true, message: 'Choose an account in your wallet.' });
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (operation !== this.operation || this.disposed) return;
      const address = accountsRevision === this.accountsRevision ? firstAddress(accounts) : this.snapshot.address;
      if (!address) {
        this.detachProvider();
        this.update({ address: null, chainId: null, pending: false, message: 'No account selected. Guest play is still available.' });
        return;
      }
      this.update({ address });
      const chainRevision = this.chainRevision;
      let network: string | null = null;
      try { network = chainId(await provider.request({ method: 'eth_chainId' })); }
      catch { /* Keep the chosen account even if reading its network is unavailable. */ }
      if (operation !== this.operation || this.disposed) return;
      if (chainRevision !== this.chainRevision) network = this.snapshot.chainId;
      this.update({ chainId: network, pending: false, message: connectedMessage(network) });
    } catch (error) {
      if (operation !== this.operation || this.disposed) return;
      if (!this.snapshot.address) this.detachProvider();
      this.update({ pending: false, message: requestError(error, false) });
    }
  }

  /** Forget this session only. Never revoke permissions or request a provider disconnection. */
  disconnect(): void {
    if (this.disposed) return;
    this.operation++;
    this.detachProvider();
    this.update({ address: null, chainId: null, pending: false, message: 'Wallet disconnected. Playing as a guest.' });
  }

  async switchToSepolia(): Promise<void> {
    if (this.disposed || this.snapshot.pending) return;
    if (!this.snapshot.address || !this.provider) {
      this.update({ message: 'Connect a wallet before switching networks.' });
      return;
    }
    if (this.snapshot.chainId === SEPOLIA_CHAIN_ID) return;
    const operation = ++this.operation;
    const chainRevision = this.chainRevision;
    const provider = this.provider;
    this.update({ pending: true, message: 'Confirm the Sepolia network switch in your wallet.' });
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID }] });
      if (operation !== this.operation || this.disposed) return;
      const network = chainRevision === this.chainRevision ? SEPOLIA_CHAIN_ID : this.snapshot.chainId;
      this.update({ chainId: network, pending: false, message: connectedMessage(network) });
    } catch (error) {
      if (operation !== this.operation || this.disposed) return;
      this.update({ pending: false, message: requestError(error, true) });
    }
  }

  dispose(): void {
    this.operation++;
    this.disposed = true;
    this.detachProvider();
    this.listeners.clear();
    this.snapshot = { address: null, chainId: null, pending: false, message: '' };
  }
}
