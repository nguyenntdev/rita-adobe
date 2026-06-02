/**
 * Unit tests for the AccountService (Task 6.1).
 *
 * The shared HTTP clients are mocked so the tests can assert endpoint wiring
 * and the normalization of each response into its result type across the three
 * cases: success-with-data, success-empty, and error-with-API-message.
 */
import { HttpError } from '../infrastructure/httpClient';
import {
  checkAccount,
  getAccount12h,
  getVariables,
  reinvite,
} from './accountService';

jest.mock('../infrastructure/httpClient', () => {
  const actual = jest.requireActual('../infrastructure/httpClient');
  return {
    ...actual,
    httpClient: { get: jest.fn(), post: jest.fn() },
    variableClient: { get: jest.fn() },
  };
});

// Import after the mock factory so we reference the mocked instances.
import { httpClient, variableClient } from '../infrastructure/httpClient';

const mockHttpPost = httpClient.post as jest.Mock;
const mockVariableGet = variableClient.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('checkAccount', () => {
  it('POSTs to /ades-support/account/check with the email in the body', async () => {
    mockHttpPost.mockResolvedValue({ data: { status: 'active' } });

    await checkAccount('user@example.com');

    expect(mockHttpPost).toHaveBeenCalledWith('/ades-support/account/check', {
      email: 'user@example.com',
    });
  });

  it('normalizes a populated response into success-with-data', async () => {
    mockHttpPost.mockResolvedValue({ data: { status: 'active', plan: 'pro' } });

    const result = await checkAccount('user@example.com');

    expect(result).toEqual({
      success: true,
      data: { status: 'active', plan: 'pro' },
    });
  });

  it('normalizes a non-object body into success-empty (empty record)', async () => {
    mockHttpPost.mockResolvedValue({ data: null });

    const result = await checkAccount('user@example.com');

    expect(result).toEqual({ success: true, data: {} });
  });

  it('surfaces the API failure reason on error', async () => {
    mockHttpPost.mockRejectedValue(
      new HttpError('Yêu cầu không hợp lệ.', {
        status: 400,
        apiMessage: 'account not found',
      }),
    );

    const result = await checkAccount('user@example.com');

    expect(result).toEqual({ success: false, error: 'account not found' });
  });
});

describe('getAccount12h', () => {
  it('POSTs to /ades-support/account-12h with the email in the body', async () => {
    mockHttpPost.mockResolvedValue({ data: [] });

    await getAccount12h('user@example.com');

    expect(mockHttpPost).toHaveBeenCalledWith('/ades-support/account-12h', {
      email: 'user@example.com',
    });
  });

  it('returns the records array for a populated response', async () => {
    const records = [{ event: 'login' }, { event: 'logout' }];
    mockHttpPost.mockResolvedValue({ data: records });

    const result = await getAccount12h('user@example.com');

    expect(result).toEqual({ success: true, data: records });
  });

  it('unwraps a { records: [...] } envelope', async () => {
    const records = [{ event: 'login' }];
    mockHttpPost.mockResolvedValue({ data: { records } });

    const result = await getAccount12h('user@example.com');

    expect(result).toEqual({ success: true, data: records });
  });

  it('returns an empty array for the no-activity (success-empty) state', async () => {
    mockHttpPost.mockResolvedValue({ data: {} });

    const result = await getAccount12h('user@example.com');

    expect(result).toEqual({ success: true, data: [] });
  });

  it('surfaces the API failure reason on error', async () => {
    mockHttpPost.mockRejectedValue(
      new HttpError('Lỗi máy chủ. Vui lòng thử lại sau.', {
        status: 500,
        apiMessage: 'upstream timeout',
      }),
    );

    const result = await getAccount12h('user@example.com');

    expect(result).toEqual({ success: false, error: 'upstream timeout' });
  });
});

describe('getVariables', () => {
  it('uses the variable client with the encoded email path and no auth header', async () => {
    mockVariableGet.mockResolvedValue({ data: { region: 'us' } });

    await getVariables('user+tag@example.com');

    // The external variable client is used (not the authenticated httpClient).
    expect(mockHttpPost).not.toHaveBeenCalled();
    expect(mockVariableGet).toHaveBeenCalledWith('/user%2Btag%40example.com');
  });

  it('normalizes a populated response into success-with-data', async () => {
    mockVariableGet.mockResolvedValue({ data: { region: 'us', tier: '1' } });

    const result = await getVariables('user@example.com');

    expect(result).toEqual({
      success: true,
      data: { region: 'us', tier: '1' },
    });
  });

  it('normalizes an empty/absent body into success-empty', async () => {
    mockVariableGet.mockResolvedValue({ data: '' });

    const result = await getVariables('user@example.com');

    expect(result).toEqual({ success: true, data: {} });
  });

  it('surfaces the failure reason on error', async () => {
    mockVariableGet.mockRejectedValue(
      new HttpError('Network error. Please check your connection.'),
    );

    const result = await getVariables('user@example.com');

    expect(result).toEqual({
      success: false,
      error: 'Network error. Please check your connection.',
    });
  });
});

describe('reinvite', () => {
  it('POSTs to /ades-support/reinvite/{email} with the encoded email', async () => {
    mockHttpPost.mockResolvedValue({ data: {} });

    await reinvite('user@example.com');

    expect(mockHttpPost).toHaveBeenCalledWith(
      '/ades-support/reinvite/user%40example.com',
    );
  });

  it('uses the API message when provided', async () => {
    mockHttpPost.mockResolvedValue({ data: { message: 'Invitation queued.' } });

    const result = await reinvite('user@example.com');

    expect(result).toEqual({ success: true, message: 'Invitation queued.' });
  });

  it('falls back to a default success message naming the email', async () => {
    mockHttpPost.mockResolvedValue({ data: {} });

    const result = await reinvite('user@example.com');

    expect(result).toEqual({
      success: true,
      message: 'Đã gửi lời mời lại tới user@example.com.',
    });
  });

  it('surfaces the API failure reason on error', async () => {
    mockHttpPost.mockRejectedValue(
      new HttpError('Invalid request.', {
        status: 400,
        apiMessage: 'email already invited',
      }),
    );

    const result = await reinvite('user@example.com');

    expect(result).toEqual({ success: false, error: 'email already invited' });
  });
});
