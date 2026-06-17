import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskCard from './TaskCard';

function baseTask(overrides = {}) {
  return {
    id: 'task-1',
    title: 'Defeat the Bug',
    priority: 'Medium',
    date: '2027-12-31',
    completed: false,
    ...overrides,
  };
}

describe('TaskCard', () => {
  it('renders title, priority, date, and xp for task', () => {
    render(
      <TaskCard
        task={baseTask({ priority: 'High', date: '2027-10-08' })}
        onToggleComplete={vi.fn()}
        onDeleteTask={vi.fn()}
        onEditTask={vi.fn()}
        isEditing={false}
        onSaveTask={vi.fn()}
      />,
    );

    expect(screen.getByText('Defeat the Bug')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('08/10/2027')).toBeInTheDocument();
    expect(screen.getByText('+100 XP')).toBeInTheDocument();
  });

  it('calls onToggleComplete with task id', async () => {
    const user = userEvent.setup();
    const onToggleComplete = vi.fn();
    render(
      <TaskCard
        task={baseTask()}
        onToggleComplete={onToggleComplete}
        onDeleteTask={vi.fn()}
        onEditTask={vi.fn()}
        isEditing={false}
        onSaveTask={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('complete-checkbox'));
    expect(onToggleComplete).toHaveBeenCalledWith('task-1');
  });

  it('calls onEditTask and onDeleteTask with task id', async () => {
    const user = userEvent.setup();
    const onEditTask = vi.fn();
    const onDeleteTask = vi.fn();
    render(
      <TaskCard
        task={baseTask()}
        onToggleComplete={vi.fn()}
        onDeleteTask={onDeleteTask}
        onEditTask={onEditTask}
        isEditing={false}
        onSaveTask={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[1]);
    await user.click(screen.getByTestId('delete-button'));

    expect(onEditTask).toHaveBeenCalledWith('task-1');
    expect(onDeleteTask).toHaveBeenCalledWith('task-1');
  });

  it('saves edited title when Enter is pressed', () => {
    const onSaveTask = vi.fn();
    render(
      <TaskCard
        task={baseTask()}
        onToggleComplete={vi.fn()}
        onDeleteTask={vi.fn()}
        onEditTask={vi.fn()}
        isEditing={true}
        onSaveTask={onSaveTask}
      />,
    );

    const input = screen.getByDisplayValue('Defeat the Bug');
    fireEvent.change(input, { target: { value: 'Defeat the Production Bug' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSaveTask).toHaveBeenCalledWith('task-1', 'Defeat the Production Bug');
  });

  it('marks overdue visual state for past uncompleted task', () => {
    const { container } = render(
      <TaskCard
        task={baseTask({ date: '2000-01-01', completed: false })}
        onToggleComplete={vi.fn()}
        onDeleteTask={vi.fn()}
        onEditTask={vi.fn()}
        isEditing={false}
        onSaveTask={vi.fn()}
      />,
    );

    expect(container.firstChild).toHaveClass('border-l-overdue-warning');
  });
});
