import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaleBanner, daysSince } from './StaleBanner.jsx';

describe('daysSince', () => {
  it('returns days between an ISO timestamp and a reference date', () => {
    const ref = new Date('2026-05-20T00:00:00Z');
    expect(daysSince('2026-05-09T00:00:00Z', ref)).toBe(11);
  });

  it('returns 0 for a future date', () => {
    const ref = new Date('2026-05-09T00:00:00Z');
    expect(daysSince('2026-05-20T00:00:00Z', ref)).toBe(0);
  });
});

describe('StaleBanner', () => {
  it('renders nothing when sheetStatus is ok and data is fresh', () => {
    const { container } = render(
      <StaleBanner sheetStatus="ok" lastSyncedAt={new Date().toISOString()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders amber banner when data is between 8 and 14 days old', () => {
    const ten = new Date();
    ten.setDate(ten.getDate() - 10);
    render(<StaleBanner sheetStatus="ok" lastSyncedAt={ten.toISOString()} />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(/stale/i);
    expect(banner).toHaveTextContent(/10 days/i);
  });

  it('renders red banner when data is more than 14 days old', () => {
    const twenty = new Date();
    twenty.setDate(twenty.getDate() - 20);
    render(<StaleBanner sheetStatus="ok" lastSyncedAt={twenty.toISOString()} />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(/20 days/i);
  });

  it('renders banner when sheetStatus is failed regardless of age', () => {
    render(<StaleBanner sheetStatus="failed" lastSyncedAt={new Date().toISOString()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
