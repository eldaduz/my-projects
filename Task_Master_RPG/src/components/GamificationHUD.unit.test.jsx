import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GamificationHUD from './GamificationHUD';

describe('GamificationHUD', () => {
  it('renders level, rank, xp values, and streak', () => {
    render(
      <GamificationHUD
        level={4}
        currentXP={120}
        maxXP={400}
        streak={7}
        rankTitle="Dungeon Raider"
      />,
    );

    expect(screen.getByText(/Level 4/i)).toBeInTheDocument();
    expect(screen.getByText('Dungeon Raider')).toBeInTheDocument();
    expect(screen.getByText('120 / 400 XP')).toBeInTheDocument();
    expect(screen.getByText('7 Day Streak')).toBeInTheDocument();
  });

  it('caps xp bar width at 100 percent', () => {
    const { container } = render(
      <GamificationHUD
        level={2}
        currentXP={500}
        maxXP={100}
        streak={0}
        rankTitle="Scroll Apprentice"
      />,
    );

    const barFill = container.querySelector('div[style]');
    expect(barFill).toHaveStyle({ width: '100%' });
  });
});
