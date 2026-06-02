import { cleanup, render, screen, within } from '@testing-library/react';

import { FieldList } from './FieldList';

/**
 * Tests for the readable Vietnamese field renderer.
 *
 * Verifies that raw API records render with Vietnamese labels, status badges,
 * formatted dates, boolean chips, and nested objects — not as a raw JSON dump.
 */

afterEach(cleanup);

describe('FieldList', () => {
  it('shows the empty message for an empty record', () => {
    render(<FieldList data={{}} emptyMessage="Không có dữ liệu" />);
    expect(screen.getByTestId('field-list-empty').textContent).toBe(
      'Không có dữ liệu',
    );
  });

  it('maps known keys to Vietnamese labels', () => {
    render(
      <FieldList
        data={{ productName: 'Adobe CCPRO', teamName: 'DEL-AlphaCore' }}
        emptyMessage="trống"
      />,
    );
    expect(screen.getByText('Tên sản phẩm')).toBeInTheDocument();
    expect(screen.getByText('Nhóm (Team)')).toBeInTheDocument();
    expect(screen.getByText('Adobe CCPRO')).toBeInTheDocument();
  });

  it('renders a status value as a Vietnamese badge', () => {
    render(<FieldList data={{ status: 'Processing' }} emptyMessage="trống" />);
    // "Processing" → "Đang xử lý" badge.
    expect(screen.getByText('Đang xử lý')).toBeInTheDocument();
    expect(screen.getByText('Trạng thái')).toBeInTheDocument();
  });

  it('formats ISO timestamps as dd/MM/yyyy HH:mm', () => {
    render(
      <FieldList data={{ updatedAt: '2026-06-02T12:53:58.740Z' }} emptyMessage="trống" />,
    );
    // Date is shown in a localized numeric format, not the raw ISO string.
    expect(screen.queryByText('2026-06-02T12:53:58.740Z')).toBeNull();
    expect(screen.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument();
  });

  it('renders booleans as Có/Không chips', () => {
    render(
      <FieldList
        data={{ accountBeingWarranted: true, warrantyProviderAccount: false }}
        emptyMessage="trống"
      />,
    );
    expect(screen.getByText('Có')).toBeInTheDocument();
    expect(screen.getByText('Không')).toBeInTheDocument();
  });

  it('renders a nested object as an indented sub-list', () => {
    render(
      <FieldList
        data={{ product: { id: 'abc-123', name: 'Adobe CCPRO' } }}
        emptyMessage="trống"
      />,
    );
    const list = screen.getByTestId('field-list');
    expect(within(list).getByText('Sản phẩm')).toBeInTheDocument();
    expect(within(list).getByText('Mã')).toBeInTheDocument();
    expect(within(list).getByText('abc-123')).toBeInTheDocument();
  });

  it('shows "Không có" for null/empty values', () => {
    render(<FieldList data={{ upgradeForm: null }} emptyMessage="trống" />);
    expect(screen.getByText('Không có')).toBeInTheDocument();
  });
});
