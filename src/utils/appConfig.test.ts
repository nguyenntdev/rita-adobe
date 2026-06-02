import { appConfig } from './appConfig';

describe('appConfig', () => {
  it('exposes the ADES Support API base URL', () => {
    expect(appConfig.apiBaseUrl).toBe('https://api-2026-02.ades.support');
  });

  it('exposes the external variable service base URL', () => {
    expect(appConfig.variableBaseUrl).toBe('https://var.ctv.ac');
  });

  it('uses a 30 second default request timeout', () => {
    expect(appConfig.requestTimeoutMs).toBe(30_000);
  });
});
