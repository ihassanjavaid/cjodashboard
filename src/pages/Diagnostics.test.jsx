import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Diagnostics } from './Diagnostics.jsx';

describe('Diagnostics page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows password prompt initially', () => {
    render(<Diagnostics />);
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('fetches diagnostics with the entered password', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lastSyncedAt: '2026-05-09T06:00:00Z',
        lastSyncStatus: { status: 'ok', perSheet: { design: 'ok' }, errors: [] },
        history: [],
      }),
    });
    render(<Diagnostics />);
    await userEvent.type(screen.getByLabelText(/password/i), 'opensesame');
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }));
    await waitFor(() => expect(screen.getByText(/last synced/i)).toBeInTheDocument());
    expect(fetch.mock.calls[0][0]).toContain('password=opensesame');
  });

  it('shows error on wrong password', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) });
    render(<Diagnostics />);
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }));
    await waitFor(() => expect(screen.getByText(/unauthorized/i)).toBeInTheDocument());
  });
});
