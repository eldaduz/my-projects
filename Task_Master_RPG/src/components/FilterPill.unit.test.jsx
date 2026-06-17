import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterPill from './FilterPill';

describe('FilterPill', () => {
  it('renders active class when active', () => {
    render(<FilterPill label="All" isActive={true} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'All' })).toHaveClass('filter-pill--active');
  });

  it('renders inactive class when not active', () => {
    render(<FilterPill label="Completed" isActive={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveClass('filter-pill--inactive');
  });

  it('calls onClick when pressed', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<FilterPill label="Active" isActive={false} onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: 'Active' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
