import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ToastNotification from './ToastNotification';

describe('ToastNotification', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render when not visible', () => {
    render(<ToastNotification message="Quest complete!" isVisible={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Quest complete!')).not.toBeInTheDocument();
  });

  it('renders message when visible', () => {
    render(<ToastNotification message="Quest complete!" isVisible={true} onClose={vi.fn()} />);
    expect(screen.getByText('Quest complete!')).toBeInTheDocument();
  });

  it('calls onClose after 2 seconds when visible', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<ToastNotification message="Quest complete!" isVisible={true} onClose={onClose} />);

    vi.advanceTimersByTime(1999);
    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
