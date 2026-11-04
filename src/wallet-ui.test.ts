// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Eip1193Provider, WalletProviderListener } from './wallet';

const ADDRESS = '0x1234567890abcdef1234567890abcdef1234abcd';
const OTHER_ADDRESS = '0x9876543210abcdef1234567890abcdef1234dcba';
const SHORT_ADDRESS = '0x1234...abcd';
const SEPOLIA = '0xaa36a7';

function click(selector: string): void {
  const button = document.querySelector<HTMLElement>(selector);
  expect(button, `Expected UI control ${selector}`).not.toBeNull();
  button!.click();
}

function identity(location: 'menu' | 'board'): string {
  const name = document.querySelector(`.wallet-${location} .wallet-identity strong`);
  expect(name).not.toBeNull();
  return name!.textContent!;
}

async function boot(): Promise<void> {
  await import('./main');
  await vi.waitFor(() => expect(document.querySelector('.hero-title')).not.toBeNull());
}

function beginPractice(): void {
  click('[data-action="start"]');
  click('[data-action="mode"][data-mode="practice"]');
  click('[data-action="begin"]');
  expect(document.querySelector('.combat-panel')).not.toBeNull();
}

function injectedWallet(initialChain = SEPOLIA) {
  let chain = initialChain;
  const listeners = new Map<string, Set<WalletProviderListener>>();
  const request = vi.fn(async ({ method, params }: Parameters<Eip1193Provider['request']>[0]) => {
    switch (method) {
      case 'eth_requestAccounts': return [ADDRESS];
      case 'eth_chainId': return chain;
      case 'wallet_switchEthereumChain':
        expect(params).toEqual([{ chainId: SEPOLIA }]);
        chain = SEPOLIA;
        return null;
      default: throw new Error(`Forbidden wallet RPC: ${method}`);
    }
  });
  const provider: Eip1193Provider = {
    request,
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    },
    removeListener(event, listener) { listeners.get(event)?.delete(listener); },
  };
  Object.defineProperty(window, 'ethereum', { configurable: true, writable: true, value: provider });
  return {
    request,
    emit(event: 'accountsChanged' | 'chainChanged', value: unknown) {
      for (const listener of [...listeners.get(event) ?? []]) listener(value);
    },
  };
}

describe('optional injected wallet in the game UI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T05:00:00Z'));
    localStorage.clear();
    window.location.hash = '';
    document.body.innerHTML = '<div id="app"></div>';
    Object.defineProperty(window, 'ethereum', { configurable: true, writable: true, value: undefined });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline wallet UI test')));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'ethereum');
  });

  it('offers Connect Wallet on the menu and leaderboard and keeps guest practice playable without a provider', async () => {
    await boot();
    const guest = identity('menu');
    expect(guest).toMatch(/^guest\d{4}$/);
    expect(document.querySelector('.wallet-menu [data-action="wallet-connect"]')!.textContent).toBe('Connect Wallet');
    click('.wallet-menu [data-action="wallet-connect"]');
    expect(document.querySelector('.wallet-menu .wallet-message')!.textContent).toMatch(/no Ethereum wallet found/i);
    expect(identity('menu')).toBe(guest);
    click('[data-action="more"]');
    expect(identity('board')).toBe(guest);
    expect(document.querySelector('.wallet-board [data-action="wallet-connect"]')!.textContent).toBe('Connect Wallet');
    click('.wallet-board [data-action="wallet-connect"]');
    expect(document.querySelector('.wallet-board .wallet-message')!.textContent).toMatch(/keep playing as a guest/i);
    click('[data-action="close"]');
    beginPractice();
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
    expect(JSON.parse(localStorage.getItem('squeekspire:v1:profile')!)).toBe(guest);
  });

  it.each(['menu', 'board'] as const)('connects from the %s only after a click and disconnects locally to the same guest', async location => {
    const wallet = injectedWallet();
    await boot();
    const guest = identity('menu');
    expect(wallet.request).not.toHaveBeenCalled();
    if (location === 'board') click('[data-action="more"]');
    click(`.wallet-${location} [data-action="wallet-connect"]`);
    await vi.waitFor(() => expect(document.querySelector(`.wallet-${location} .wallet-network`)!.textContent).toBe('Sepolia'));
    expect(identity(location)).toBe(SHORT_ADDRESS);
    expect(wallet.request.mock.calls.map(([request]) => request)).toEqual([
      { method: 'eth_requestAccounts' }, { method: 'eth_chainId' },
    ]);
    expect(document.querySelector('[data-action="wallet-switch"]')).toBeNull();
    if (location === 'menu') click('[data-action="more"]');
    expect(identity('board')).toBe(SHORT_ADDRESS);
    click('.wallet-board [data-action="wallet-disconnect"]');
    expect(identity('board')).toBe(guest);
    expect(document.querySelector('.wallet-board [data-action="wallet-connect"]')).not.toBeNull();
    expect(wallet.request).toHaveBeenCalledTimes(2);
    wallet.emit('accountsChanged', [OTHER_ADDRESS]);
    expect(identity('board')).toBe(guest);
    click('[data-action="close"]');
    expect(identity('menu')).toBe(guest);
    expect(JSON.parse(localStorage.getItem('squeekspire:v1:profile')!)).toBe(guest);
  });

  it('offers an explicit Sepolia switch on a different chain and hides it after the switch', async () => {
    const wallet = injectedWallet('0x1');
    await boot();
    click('.wallet-menu [data-action="wallet-connect"]');
    await vi.waitFor(() => expect(document.querySelector<HTMLButtonElement>('.wallet-menu [data-action="wallet-switch"]')?.disabled).toBe(false));
    expect(identity('menu')).toBe(SHORT_ADDRESS);
    expect(wallet.request).toHaveBeenCalledTimes(2);
    click('.wallet-menu [data-action="wallet-switch"]');
    await vi.waitFor(() => expect(document.querySelector('.wallet-menu .wallet-network')!.textContent).toBe('Sepolia'));
    expect(document.querySelector('[data-action="wallet-switch"]')).toBeNull();
    expect(wallet.request.mock.calls.map(([request]) => request)).toEqual([
      { method: 'eth_requestAccounts' },
      { method: 'eth_chainId' },
      { method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA }] },
    ]);
    click('[data-action="more"]');
    expect(document.querySelector('.wallet-board [data-action="wallet-switch"]')).toBeNull();
    expect(document.querySelector('.wallet-board .wallet-network')!.textContent).toBe('Sepolia');
  });

  it('reflects account and chain events in both surfaces and returns to the same guest when accounts become empty', async () => {
    const wallet = injectedWallet();
    await boot();
    const guest = identity('menu');
    click('.wallet-menu [data-action="wallet-connect"]');
    await vi.waitFor(() => expect(document.querySelector('.wallet-menu .wallet-network')!.textContent).toBe('Sepolia'));
    wallet.emit('accountsChanged', [OTHER_ADDRESS]);
    expect(identity('menu')).toBe('0x9876...dcba');
    wallet.emit('chainChanged', '0x1');
    expect(document.querySelector('.wallet-menu [data-action="wallet-switch"]')).not.toBeNull();
    click('[data-action="more"]');
    expect(identity('board')).toBe('0x9876...dcba');
    wallet.emit('chainChanged', SEPOLIA);
    expect(document.querySelector('.wallet-board [data-action="wallet-switch"]')).toBeNull();
    wallet.emit('accountsChanged', []);
    expect(identity('board')).toBe(guest);
    expect(document.querySelector('.wallet-board [data-action="wallet-connect"]')).not.toBeNull();
    expect(wallet.request).toHaveBeenCalledTimes(2);
    click('[data-action="close"]');
    expect(identity('menu')).toBe(guest);
  });

  it('records a finished practice run with the full address and displays a shortened leaderboard identity', async () => {
    const wallet = injectedWallet();
    await boot();
    click('.wallet-menu [data-action="wallet-connect"]');
    await vi.waitFor(() => expect(document.querySelector('.wallet-menu .wallet-network')!.textContent).toBe('Sepolia'));
    beginPractice();
    click('[data-action="more"]');
    click('[data-action="abandon"]');
    expect(document.querySelector('.run-result')).not.toBeNull();
    const savedRows = JSON.parse(localStorage.getItem('squeekspire:v1:board')!);
    expect(savedRows).toHaveLength(1);
    expect(savedRows[0]).toMatchObject({ profile: ADDRESS, mode: 'practice', won: false });
    expect(savedRows[0].id.startsWith(`${ADDRESS}:`)).toBe(true);
    click('[data-action="more"]');
    expect(identity('board')).toBe(SHORT_ADDRESS);
    expect(document.querySelectorAll('.leaderboard-row')).toHaveLength(1);
    expect(document.querySelector('.leaderboard-row.you .board-id')!.textContent).toContain(`${SHORT_ADDRESS} YOU`);
    expect(document.querySelector('.leaderboard')!.textContent).not.toContain(ADDRESS);
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
    expect(wallet.request).toHaveBeenCalledTimes(2);
  });
});
