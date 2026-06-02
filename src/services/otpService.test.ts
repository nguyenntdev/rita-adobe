import { otpService, readOTP } from './otpService';
import { httpClient, HttpError } from '../infrastructure/httpClient';

jest.mock('../infrastructure/httpClient', () => {
  const actual = jest.requireActual('../infrastructure/httpClient');
  return {
    ...actual,
    httpClient: { get: jest.fn() },
  };
});

const mockedGet = httpClient.get as jest.Mock;

describe('otpService.readOTP', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('requests the read-otp-gpm endpoint with the email query param', async () => {
    mockedGet.mockResolvedValue({ data: { otp: '123456' } });

    await readOTP('user@example.com');

    expect(mockedGet).toHaveBeenCalledWith('/mail/read-otp-gpm', {
      params: { email: 'user@example.com' },
    });
  });

  it('returns the OTP value on success (object payload)', async () => {
    mockedGet.mockResolvedValue({ data: { otp: '654321' } });

    const result = await readOTP('user@example.com');

    expect(result).toEqual({ success: true, otp: '654321' });
  });

  it('returns the OTP value on success (bare string payload)', async () => {
    mockedGet.mockResolvedValue({ data: '  987654  ' });

    const result = await readOTP('user@example.com');

    expect(result).toEqual({ success: true, otp: '987654' });
  });

  it('coerces a numeric OTP code to a string', async () => {
    mockedGet.mockResolvedValue({ data: { code: 246810 } });

    const result = await readOTP('user@example.com');

    expect(result).toEqual({ success: true, otp: '246810' });
  });

  it('returns the no-OTP-found state when the payload has no OTP', async () => {
    mockedGet.mockResolvedValue({ data: {} });

    const result = await readOTP('user@example.com');

    expect(result.success).toBe(true);
    expect(result.otp).toBeUndefined();
  });

  it('returns the no-OTP-found state for an empty string payload', async () => {
    mockedGet.mockResolvedValue({ data: '   ' });

    const result = await readOTP('user@example.com');

    expect(result.success).toBe(true);
    expect(result.otp).toBeUndefined();
  });

  it('surfaces the API failure reason when the request fails', async () => {
    mockedGet.mockRejectedValue(
      new HttpError('Server error. Please try again later.', {
        status: 500,
        apiMessage: 'mailbox unavailable',
      }),
    );

    const result = await readOTP('user@example.com');

    expect(result).toEqual({ success: false, error: 'mailbox unavailable' });
  });

  it('falls back to the mapped user message when no API message exists', async () => {
    mockedGet.mockRejectedValue(
      new HttpError('Network error. Please check your connection.'),
    );

    const result = await readOTP('user@example.com');

    expect(result).toEqual({
      success: false,
      error: 'Network error. Please check your connection.',
    });
  });

  it('exposes readOTP through the OTPService implementation', () => {
    expect(otpService.readOTP).toBe(readOTP);
  });
});
