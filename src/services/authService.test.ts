import { authService } from './authService';
import { HttpError, httpClient } from '../infrastructure/httpClient';
import {
  clearToken,
  getToken,
  isTokenExpired,
  storeToken,
} from '../infrastructure/sessionStore';

jest.mock('../infrastructure/httpClient', () => {
  const actual = jest.requireActual('../infrastructure/httpClient');
  return {
    ...actual,
    httpClient: { post: jest.fn() },
  };
});

jest.mock('../infrastructure/sessionStore', () => ({
  storeToken: jest.fn(() => true),
  clearToken: jest.fn(() => true),
  getToken: jest.fn(),
  isTokenExpired: jest.fn(),
}));

const mockedPost = httpClient.post as jest.Mock;
const mockedStoreToken = storeToken as jest.Mock;
const mockedClearToken = clearToken as jest.Mock;
const mockedGetToken = getToken as jest.Mock;
const mockedIsTokenExpired = isTokenExpired as jest.Mock;

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('returns the token and stores it with expiry on success', async () => {
      mockedPost.mockResolvedValue({ data: { token: 'abc123', expiresIn: 3600 } });
      const before = Date.now();

      const result = await authService.login('user', 'pass');

      expect(result).toEqual({ success: true, token: 'abc123' });
      expect(mockedStoreToken).toHaveBeenCalledTimes(1);
      const [storedToken, storedExpiresAt] = mockedStoreToken.mock.calls[0];
      expect(storedToken).toBe('abc123');
      // expiresIn (seconds) is converted to an absolute ms timestamp.
      expect(storedExpiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
    });

    it('supports the access_token / expiresAt response shape', async () => {
      const expiresAt = Date.now() + 5_000;
      mockedPost.mockResolvedValue({
        data: { access_token: 'tok', expiresAt },
      });

      const result = await authService.login('user', 'pass');

      expect(result).toEqual({ success: true, token: 'tok' });
      expect(mockedStoreToken).toHaveBeenCalledWith('tok', expiresAt);
    });

    it('surfaces the API failure reason on error', async () => {
      mockedPost.mockRejectedValue(
        new HttpError('Request failed. Please try again.', {
          status: 400,
          apiMessage: 'Invalid credentials',
        }),
      );

      const result = await authService.login('user', 'bad');

      expect(result).toEqual({ success: false, error: 'Invalid credentials' });
      expect(mockedStoreToken).not.toHaveBeenCalled();
    });

    it('falls back to the user message when no API message is present', async () => {
      mockedPost.mockRejectedValue(
        new HttpError('Network error. Please check your connection.'),
      );

      const result = await authService.login('user', 'pass');

      expect(result).toEqual({
        success: false,
        error: 'Network error. Please check your connection.',
      });
    });

    it('fails when the response carries no usable token', async () => {
      mockedPost.mockResolvedValue({ data: { somethingElse: true } });

      const result = await authService.login('user', 'pass');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockedStoreToken).not.toHaveBeenCalled();
    });
  });

  // Task 5.4: integration test for auth token endpoint wiring. With the HTTP
  // client mocked, assert `login` targets `/ades-support/auth/token` with the
  // submitted credentials (Requirement 1.2) and surfaces the API-provided error
  // message on failure (Requirement 1.4).
  describe('auth token endpoint wiring (integration)', () => {
    it('issues a POST to /ades-support/auth/token with the credentials', async () => {
      mockedPost.mockResolvedValue({ data: { token: 'abc123', expiresIn: 3600 } });

      await authService.login('support-user', 's3cret');

      expect(mockedPost).toHaveBeenCalledTimes(1);
      expect(mockedPost).toHaveBeenCalledWith('/ades-support/auth/token', {
        username: 'support-user',
        password: 's3cret',
      });
    });

    it('surfaces the API error message from the token endpoint on failure', async () => {
      mockedPost.mockRejectedValue(
        new HttpError('Request failed. Please try again.', {
          status: 401,
          apiMessage: 'Account locked. Contact an administrator.',
        }),
      );

      const result = await authService.login('support-user', 'wrong-pass');

      expect(mockedPost).toHaveBeenCalledWith('/ades-support/auth/token', {
        username: 'support-user',
        password: 'wrong-pass',
      });
      expect(result).toEqual({
        success: false,
        error: 'Account locked. Contact an administrator.',
      });
      expect(mockedStoreToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears the stored token', () => {
      authService.logout();
      expect(mockedClearToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('getToken', () => {
    it('delegates to the session store', () => {
      mockedGetToken.mockReturnValue('stored-token');
      expect(authService.getToken()).toBe('stored-token');
    });
  });

  describe('isTokenExpired', () => {
    it('delegates to the session store', () => {
      mockedIsTokenExpired.mockReturnValue(true);
      expect(authService.isTokenExpired()).toBe(true);
    });
  });

  describe('isAuthenticated', () => {
    it('is true only with a token that is not expired', () => {
      mockedGetToken.mockReturnValue('stored-token');
      mockedIsTokenExpired.mockReturnValue(false);
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('is false when no token is stored', () => {
      mockedGetToken.mockReturnValue(null);
      mockedIsTokenExpired.mockReturnValue(false);
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('is false when the token is expired', () => {
      mockedGetToken.mockReturnValue('stored-token');
      mockedIsTokenExpired.mockReturnValue(true);
      expect(authService.isAuthenticated()).toBe(false);
    });
  });
});
