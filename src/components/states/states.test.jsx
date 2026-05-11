import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkeletonState } from './SkeletonState.jsx';
import { ErrorState } from './ErrorState.jsx';
import { EmptyState } from './EmptyState.jsx';

describe('SkeletonState', () => {
  it('renders without crashing and has skeleton role', () => {
    render(<SkeletonState />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders the error message and retry button', () => {
    render(<ErrorState message="Boom" onRetry={() => {}} />);
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry when the button is clicked', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Boom" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyState', () => {
  it('renders with default message', () => {
    render(<EmptyState />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it('renders the lastSyncedAt timestamp when provided', () => {
    render(<EmptyState lastSyncedAt="2026-05-09T06:00:00Z" />);
    expect(screen.getByText(/last synced/i)).toBeInTheDocument();
  });
});
