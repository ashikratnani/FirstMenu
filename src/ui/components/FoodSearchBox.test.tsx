import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FoodSearchBox from './FoodSearchBox';

describe('FoodSearchBox', () => {
  it('calls onCommit from the Add button', async () => {
    const onCommit = vi.fn();
    render(<FoodSearchBox value="rice" onChange={() => {}} onCommit={onCommit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('calls onCommit on Enter', async () => {
    const onCommit = vi.fn();
    render(<FoodSearchBox value="rice" onChange={() => {}} onCommit={onCommit} />);
    await userEvent.type(screen.getByRole('textbox'), '{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('shows no Add button without onCommit', () => {
    render(<FoodSearchBox value="rice" onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });
});
