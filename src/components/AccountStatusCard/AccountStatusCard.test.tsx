import { cleanup, render, screen } from '@testing-library/react';

import { AccountStatusCard } from './AccountStatusCard';

/**
 * Tests for the account profile card.
 *
 * The card must render the useful profile fields and, crucially, OMIT the
 * noisy `parentMultiNote` (the same handling note duplicated in 4 languages).
 */

const SAMPLE = {
  email: 'hnanhvu2704@renew.fyi',
  status: 'Processing',
  productName: 'Adobe CCPRO, Renewable Account, 12 Month',
  teamName: 'DEL-AlphaCore Digital',
  groupName: 'Adobe CCPRO Renew, Available Account',
  product: { id: '935d864d', name: 'Adobe CCPRO', upgradeForm: null },
  updatedAt: '2026-06-02T12:53:58.740Z',
  note: 'Tắt các App Adobe ➔ Mở app Creative Cloud',
  warrantyProviderAccount: null,
  productAccessUrl: '',
  parentMultiNote: {
    '530a6d77': [{ note: 'Закройте все приложения Adobe', type: 'MainNote' }],
    '96b89f6a': [{ note: 'Close all Adobe apps', type: 'MainNote' }],
  },
};

afterEach(cleanup);

describe('AccountStatusCard', () => {
  it('renders email, status badge, product and team', () => {
    render(<AccountStatusCard data={SAMPLE} />);

    expect(screen.getByTestId('account-email').textContent).toBe(
      'hnanhvu2704@renew.fyi',
    );
    // "Processing" → Vietnamese badge (means processed/ready).
    expect(screen.getByTestId('account-status-badge').textContent).toBe(
      'Đã xử lý',
    );
    expect(
      screen.getByText('Adobe CCPRO, Renewable Account, 12 Month'),
    ).toBeInTheDocument();
    expect(screen.getByText('DEL-AlphaCore Digital')).toBeInTheDocument();
  });

  it('shows the Vietnamese handling note', () => {
    render(<AccountStatusCard data={SAMPLE} />);
    expect(
      screen.getByText(/Tắt các App Adobe/),
    ).toBeInTheDocument();
  });

  it('OMITS the multilingual parentMultiNote duplicates', () => {
    render(<AccountStatusCard data={SAMPLE} />);
    // None of the duplicated foreign-language notes should appear.
    expect(screen.queryByText(/Закройте все приложения/)).toBeNull();
    expect(screen.queryByText(/Close all Adobe apps/)).toBeNull();
    expect(screen.queryByText('parentMultiNote')).toBeNull();
  });

  it('omits empty fields (e.g. blank productAccessUrl)', () => {
    render(<AccountStatusCard data={SAMPLE} />);
    // The access link is only rendered when productAccessUrl is non-empty.
    expect(screen.queryByText(/Mở trang truy cập/)).toBeNull();
  });
});
