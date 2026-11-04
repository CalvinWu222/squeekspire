import { describe, expect, it, vi } from 'vitest';
import {
  isWalletAddress, SEPOLIA_CHAIN_ID, shortenAddress, WalletController,
  type Eip1193Provider, type WalletProviderListener,
} from './wallet';

const ADDRESS = '0x1234567890abcdef1234567890abcdef1234abcd';
const OTHER_ADDRESS = '0xabcdef1234567890abcdef1234567890abcdef12';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function mockProvider() {
  const listeners = new Map<string, Set<WalletProviderListener>>();
  const request = vi.fn<Eip1193Provider['request']>(async ({ method }) => {
    if (method === 'eth_requestAccounts') return [ADDRESS];
    if (method === 'eth_chainId') return SEPOLIA_CHAIN_ID;
    if (method === 'wallet_switchEthereumChain') return null;
    throw new Error(`Unexpected RPC method: ${method}`);
  });
  const on = vi.fn((event: string, listener: WalletProviderListener) => {
    const callbacks = listeners.get(event) ?? new Set();
    callbacks.add(listener);
    listeners.set(event, callbacks);
  });
  const removeListener = vi.fn((event: string, listener: WalletProviderListener) => {
    listeners.get(event)?.delete(listener);
  });
  return {
    request, on, removeListener,
    emit(event: string, value: unknown) { for (const listener of listeners.get(event) ?? []) listener(value); },
    listenerCount(event: string) { return listeners.get(event)?.size ?? 0; },
  };
}

describe('wallet address display', () => {
  it('accepts only complete hexadecimal Ethereum addresses', () => {
    expect(isWalletAddress(ADDRESS)).toBe(true);
    expect(isWalletAddress(OTHER_ADDRESS.toUpperCase())).toBe(true);
    for (const invalid of [null, undefined, {}, 123, '', '0x1234', `${ADDRESS}0`, ADDRESS.replace('a', 'g'), '<script>']) {
      expect(isWalletAddress(invalid)).toBe(false);
    }
  });

  it('shortens an address for the player name while preserving its case', () => {
    expect(shortenAddress(ADDRESS)).toBe('0x1234...abcd');
    expect(shortenAddress('guest1234')).toBe('guest1234');
  });
});

describe('explicit account connection', () => {
  it('does not access a provider, request permissions, or subscribe before the user connects', () => {
    const provider = mockProvider();
    const getProvider = vi.fn(() => provider);
    const wallet = new WalletController(getProvider);
    expect(wallet.state).toEqual({ address: null, chainId: null, pending: false, message: '' });
    expect(getProvider).not.toHaveBeenCalled();
    expect(provider.request).not.toHaveBeenCalled();
    expect(provider.on).not.toHaveBeenCalled();
  });

  it('requests account access and reads the network without issuing signing or transaction requests', async () => {
    const provider = mockProvider();
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    expect(wallet.state).toMatchObject({ address: ADDRESS, chainId: SEPOLIA_CHAIN_ID, pending: false });
    expect(provider.request.mock.calls).toEqual([
      [{ method: 'eth_requestAccounts' }], [{ method: 'eth_chainId' }],
    ]);
    expect(provider.listenerCount('accountsChanged')).toBe(1);
    expect(provider.listenerCount('chainChanged')).toBe(1);
  });

  it('allows guest play and gives a clear message when no injected wallet is installed', async () => {
    const wallet = new WalletController(() => undefined);
    await wallet.connect();
    expect(wallet.state).toMatchObject({ address: null, chainId: null, pending: false });
    expect(wallet.state.message).toContain('No Ethereum wallet found');
    expect(wallet.state.message).toContain('guest');
  });

  it('handles a provider getter blocked by the browser', async () => {
    const wallet = new WalletController(() => { throw new Error('Blocked'); });
    await expect(wallet.connect()).resolves.toBeUndefined();
    expect(wallet.state.message).toContain('No Ethereum wallet found');
  });

  it('returns to guest play after a rejected connection without displaying provider text', async () => {
    const provider = mockProvider();
    provider.request.mockRejectedValue({ code: 4001, message: '<unsafe provider text>' });
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    expect(wallet.state).toMatchObject({ address: null, pending: false });
    expect(wallet.state.message).toContain('connection canceled');
    expect(wallet.state.message).not.toContain('unsafe');
    expect(provider.listenerCount('accountsChanged')).toBe(0);
    expect(provider.listenerCount('chainChanged')).toBe(0);
  });

  it('handles an already pending wallet request and unknown connection errors', async () => {
    const provider = mockProvider();
    const wallet = new WalletController(() => provider);
    provider.request.mockRejectedValueOnce({ code: -32002 });
    await wallet.connect();
    expect(wallet.state.message).toContain('already open');
    provider.request.mockRejectedValueOnce('Unexpected error');
    await wallet.connect();
    expect(wallet.state.message).toContain('Unable to connect wallet');
    expect(wallet.state.pending).toBe(false);
  });

  it('rejects empty or malformed account responses without reading a chain', async () => {
    for (const response of [[], ['0x1234'], 'not accounts', null, ['<img src=x>']]) {
      const provider = mockProvider();
      provider.request.mockResolvedValueOnce(response);
      const wallet = new WalletController(() => provider);
      await wallet.connect();
      expect(wallet.state).toMatchObject({ address: null, chainId: null, pending: false });
      expect(wallet.state.message).toContain('No account selected');
      expect(provider.request).toHaveBeenCalledTimes(1);
      expect(provider.listenerCount('accountsChanged')).toBe(0);
    }
  });

  it('keeps the account and offers a switch when a network read fails', async () => {
    const provider = mockProvider();
    provider.request.mockResolvedValueOnce([ADDRESS]).mockRejectedValueOnce(new Error('Network unavailable'));
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    expect(wallet.state).toMatchObject({ address: ADDRESS, chainId: null, pending: false });
    expect(wallet.state.message).toContain('switch to Sepolia');
    await wallet.switchToSepolia();
    expect(wallet.state.chainId).toBe(SEPOLIA_CHAIN_ID);
  });

  it('treats malformed chain IDs as unknown and normalizes valid hexadecimal chain IDs', async () => {
    const provider = mockProvider();
    provider.request.mockResolvedValueOnce([ADDRESS]).mockResolvedValueOnce('not a chain');
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    expect(wallet.state.chainId).toBeNull();
    provider.emit('chainChanged', '0x00AA36A7');
    expect(wallet.state.chainId).toBe(SEPOLIA_CHAIN_ID);
  });

  it('ignores duplicate connect and switch clicks while account selection is pending', async () => {
    const accounts = deferred<unknown>();
    const provider = mockProvider();
    provider.request.mockReturnValueOnce(accounts.promise);
    const wallet = new WalletController(() => provider);
    const connecting = wallet.connect();
    expect(wallet.state.pending).toBe(true);
    await wallet.connect();
    await wallet.switchToSepolia();
    expect(provider.request).toHaveBeenCalledTimes(1);
    accounts.resolve([ADDRESS]);
    await connecting;
    expect(wallet.state.pending).toBe(false);
    expect(provider.request).toHaveBeenCalledTimes(2);
  });
});

describe('wallet events and local disconnection', () => {
  it('updates the account and network in response to provider events', async () => {
    const provider = mockProvider();
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    provider.emit('accountsChanged', [OTHER_ADDRESS]);
    expect(wallet.state.address).toBe(OTHER_ADDRESS);
    provider.emit('chainChanged', '0x1');
    expect(wallet.state.chainId).toBe('0x1');
    expect(wallet.state.message).toContain('switch to Sepolia');
    provider.emit('chainChanged', SEPOLIA_CHAIN_ID);
    expect(wallet.state.message).toBe('Connected to Sepolia.');
    expect(provider.request).toHaveBeenCalledTimes(2);
  });

  it('forgets the local account and removes event listeners without making any RPC call', async () => {
    const provider = mockProvider();
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    const before = provider.request.mock.calls.length;
    wallet.disconnect();
    expect(wallet.state).toMatchObject({ address: null, chainId: null, pending: false });
    expect(wallet.state.message).toContain('guest');
    expect(provider.request).toHaveBeenCalledTimes(before);
    expect(provider.removeListener).toHaveBeenCalledTimes(2);
    provider.emit('accountsChanged', [OTHER_ADDRESS]);
    expect(wallet.state.address).toBeNull();
  });

  it('returns to a guest when the wallet exposes no accounts', async () => {
    const provider = mockProvider();
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    provider.emit('accountsChanged', []);
    expect(wallet.state).toMatchObject({ address: null, chainId: null, pending: false });
    expect(provider.listenerCount('accountsChanged')).toBe(0);
    expect(provider.request).toHaveBeenCalledTimes(2);
  });

  it('does not restore an account from a connection response received after local disconnect', async () => {
    const accounts = deferred<unknown>();
    const provider = mockProvider();
    provider.request.mockReturnValueOnce(accounts.promise);
    const wallet = new WalletController(() => provider);
    const connecting = wallet.connect();
    wallet.disconnect();
    accounts.resolve([ADDRESS]);
    await connecting;
    expect(wallet.state).toMatchObject({ address: null, chainId: null, pending: false });
    expect(provider.request).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a newer account event with an older account response', async () => {
    const accounts = deferred<unknown>();
    const provider = mockProvider();
    provider.request.mockReturnValueOnce(accounts.promise);
    const wallet = new WalletController(() => provider);
    const connecting = wallet.connect();
    provider.emit('accountsChanged', [OTHER_ADDRESS]);
    accounts.resolve([ADDRESS]);
    await connecting;
    expect(wallet.state.address).toBe(OTHER_ADDRESS);
  });

  it('does not overwrite a chain change that arrives during a chain read', async () => {
    const network = deferred<unknown>();
    const provider = mockProvider();
    provider.request.mockResolvedValueOnce([ADDRESS]).mockReturnValueOnce(network.promise);
    const wallet = new WalletController(() => provider);
    const connecting = wallet.connect();
    await vi.waitFor(() => expect(provider.request).toHaveBeenCalledTimes(2));
    provider.emit('chainChanged', '0x1');
    network.resolve(SEPOLIA_CHAIN_ID);
    await connecting;
    expect(wallet.state.chainId).toBe('0x1');
  });

  it('does not restore an account when an empty accounts event interrupts a connection', async () => {
    const accounts = deferred<unknown>();
    const provider = mockProvider();
    provider.request.mockReturnValueOnce(accounts.promise);
    const wallet = new WalletController(() => provider);
    const connecting = wallet.connect();
    provider.emit('accountsChanged', []);
    accounts.resolve([ADDRESS]);
    await connecting;
    expect(wallet.state.address).toBeNull();
    expect(provider.request).toHaveBeenCalledTimes(1);
  });

  it('isolates stale callbacks even when a provider has no listener removal API', async () => {
    const mock = mockProvider();
    const provider: Eip1193Provider = { request: mock.request, on: mock.on };
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    wallet.disconnect();
    mock.emit('accountsChanged', [OTHER_ADDRESS]);
    expect(wallet.state.address).toBeNull();
    await wallet.connect();
    const changes = vi.fn();
    wallet.subscribe(changes);
    mock.emit('accountsChanged', [OTHER_ADDRESS]);
    expect(wallet.state.address).toBe(OTHER_ADDRESS);
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it('provides snapshots and an unsubscribe function instead of exposing mutable internal state', async () => {
    const wallet = new WalletController(() => mockProvider());
    const updates = vi.fn();
    const unsubscribe = wallet.subscribe(updates);
    expect(updates).toHaveBeenCalledTimes(1);
    updates.mock.calls[0][0].address = OTHER_ADDRESS;
    expect(wallet.state.address).toBeNull();
    await wallet.connect();
    const snapshot = wallet.state;
    snapshot.address = OTHER_ADDRESS;
    expect(wallet.state.address).toBe(ADDRESS);
    unsubscribe();
    const before = updates.mock.calls.length;
    wallet.disconnect();
    expect(updates).toHaveBeenCalledTimes(before);
  });

  it('disposes listeners and ignores pending request results or future actions', async () => {
    const accounts = deferred<unknown>();
    const provider = mockProvider();
    provider.request.mockReturnValueOnce(accounts.promise);
    const wallet = new WalletController(() => provider);
    const subscriber = vi.fn();
    wallet.subscribe(subscriber);
    const connecting = wallet.connect();
    wallet.dispose();
    const before = subscriber.mock.calls.length;
    accounts.resolve([ADDRESS]);
    await connecting;
    await wallet.connect();
    await wallet.switchToSepolia();
    wallet.disconnect();
    expect(wallet.state).toEqual({ address: null, chainId: null, pending: false, message: '' });
    expect(provider.request).toHaveBeenCalledTimes(1);
    expect(provider.listenerCount('accountsChanged')).toBe(0);
    expect(subscriber).toHaveBeenCalledTimes(before);
  });
});

describe('explicit Sepolia switching', () => {
  it('only switches after a user action, using the exact Sepolia network parameter', async () => {
    const provider = mockProvider();
    provider.request.mockResolvedValueOnce([ADDRESS]).mockResolvedValueOnce('0x1');
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    expect(provider.request).toHaveBeenCalledTimes(2);
    expect(wallet.state.chainId).toBe('0x1');
    await wallet.switchToSepolia();
    expect(provider.request.mock.calls[2]).toEqual([
      { method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID }] },
    ]);
    expect(wallet.state).toMatchObject({ address: ADDRESS, chainId: SEPOLIA_CHAIN_ID, pending: false });
    expect(provider.request.mock.calls.every(([request]) =>
      ['eth_requestAccounts', 'eth_chainId', 'wallet_switchEthereumChain'].includes(request.method))).toBe(true);
  });

  it('does not open a network request for a guest or a wallet already on Sepolia', async () => {
    const provider = mockProvider();
    const wallet = new WalletController(() => provider);
    await wallet.switchToSepolia();
    expect(wallet.state.message).toContain('Connect a wallet');
    expect(provider.request).not.toHaveBeenCalled();
    await wallet.connect();
    await wallet.switchToSepolia();
    expect(provider.request).toHaveBeenCalledTimes(2);
  });

  it('keeps the connected account and original chain after a rejected network switch', async () => {
    const provider = mockProvider();
    provider.request.mockResolvedValueOnce([ADDRESS]).mockResolvedValueOnce('0x1').mockRejectedValueOnce({ code: 4001 });
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    await wallet.switchToSepolia();
    expect(wallet.state).toMatchObject({ address: ADDRESS, chainId: '0x1', pending: false });
    expect(wallet.state.message).toBe('Network switch canceled.');
  });

  it('explains unsupported Sepolia without automatically adding a chain', async () => {
    const provider = mockProvider();
    provider.request.mockResolvedValueOnce([ADDRESS]).mockResolvedValueOnce('0x1').mockRejectedValueOnce({ code: 4902 });
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    await wallet.switchToSepolia();
    expect(wallet.state.message).toContain('Add Sepolia in your wallet');
    expect(provider.request).toHaveBeenCalledTimes(3);
    expect(provider.request.mock.calls.at(-1)?.[0].method).toBe('wallet_switchEthereumChain');
  });

  it('keeps a newer chain event authoritative when a switch request resolves', async () => {
    const switching = deferred<unknown>();
    const provider = mockProvider();
    provider.request.mockResolvedValueOnce([ADDRESS]).mockResolvedValueOnce('0x1').mockReturnValueOnce(switching.promise);
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    const switched = wallet.switchToSepolia();
    await wallet.switchToSepolia();
    provider.emit('chainChanged', '0x89');
    switching.resolve(null);
    await switched;
    expect(wallet.state).toMatchObject({ chainId: '0x89', pending: false });
    expect(provider.request).toHaveBeenCalledTimes(3);
  });

  it('ignores a pending switch result after a local disconnect', async () => {
    const switching = deferred<unknown>();
    const provider = mockProvider();
    provider.request.mockResolvedValueOnce([ADDRESS]).mockResolvedValueOnce('0x1').mockReturnValueOnce(switching.promise);
    const wallet = new WalletController(() => provider);
    await wallet.connect();
    const switched = wallet.switchToSepolia();
    wallet.disconnect();
    switching.resolve(null);
    await switched;
    expect(wallet.state).toMatchObject({ address: null, chainId: null, pending: false });
    expect(provider.request).toHaveBeenCalledTimes(3);
  });
});
