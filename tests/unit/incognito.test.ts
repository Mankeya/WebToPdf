import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isIncognitoContext, setStorageIfPersistent } from '../../src/shared/incognito';

function stubExtension(inIncognitoContext: unknown): void {
  const extension = inIncognitoContext === undefined ? {} : { inIncognitoContext };
  vi.stubGlobal('chrome', { extension, storage: { local: { set: vi.fn(async () => undefined) } } });
}

describe('detecção do contexto anônimo', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('reporta anônimo somente com inIncognitoContext estritamente true', () => {
    stubExtension(true);
    expect(isIncognitoContext()).toBe(true);
    stubExtension(false);
    expect(isIncognitoContext()).toBe(false);
    stubExtension(undefined);
    expect(isIncognitoContext()).toBe(false);
    stubExtension('true');
    expect(isIncognitoContext()).toBe(false);
  });

  it('fora do Chrome a resposta é false (comportamento padrão)', () => {
    vi.stubGlobal('chrome', undefined);
    expect(isIncognitoContext()).toBe(false);
    vi.stubGlobal('chrome', {});
    expect(isIncognitoContext()).toBe(false);
  });
});

describe('gravação de preferências fora do anônimo', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('grava normalmente no contexto normal e retorna true', async () => {
    stubExtension(false);
    const items = { theme: 'dark' };
    await expect(setStorageIfPersistent(items)).resolves.toBe(true);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(items);
  });

  it('não grava nada no contexto anônimo e retorna false', async () => {
    stubExtension(true);
    await expect(setStorageIfPersistent({ theme: 'dark' })).resolves.toBe(false);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
