import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncButton } from './SyncButton.jsx';

describe('SyncButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders idle state by default', () => {
    render(<SyncButton onSyncComplete={() => {}} />);
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
  });

  it('shows syncing state during request', async () => {
    let resolveFetch;
    fetch.mockImplementation(() => new Promise(r => { resolveFetch = r; }));

    render(<SyncButton onSyncComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sync now/i }));
    expect(screen.getByRole('button', { name: /syncing/i })).toBeInTheDocument();
    resolveFetch({ ok: true, json: async () => ({ ok: true, lastSyncedAt: 'T' }) });
  });

  it('calls onSyncComplete with the response data after success', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, lastSyncedAt: '2026-05-09T06:00:00Z', perSheet: { design: 'ok' } }),
    });
    const onSyncComplete = vi.fn();
    render(<SyncButton onSyncComplete={onSyncComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /sync now/i }));
    await waitFor(() => expect(onSyncComplete).toHaveBeenCalledWith(
      expect.objectContaining({ lastSyncedAt: '2026-05-09T06:00:00Z' })
    ));
  });

  it('shows cooldown state when 429 returned', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'cooldown', retryAfterSeconds: 90 }),
    });
    render(<SyncButton onSyncComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sync now/i }));
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    expect(screen.getByRole('button').textContent).toMatch(/cooldown/i);
  });

  it('shows failed state on network error', async () => {
    fetch.mockRejectedValueOnce(new Error('network'));
    render(<SyncButton onSyncComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sync now/i }));
    await waitFor(() => expect(screen.getByRole('button').textContent).toMatch(/failed/i));
  });

  it('calls /api/manual-sync (not /api/sync)', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<SyncButton onSyncComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sync now/i }));
    expect(fetch).toHaveBeenCalledWith('/api/manual-sync', expect.objectContaining({ method: 'POST' }));
  });
});
