import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlaceholderPage } from './PlaceholderPage';

describe('PlaceholderPage', () => {
  it('renders the supplied page title', () => {
    render(<PlaceholderPage title="Voting application placeholder" />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Voting application placeholder',
      }),
    ).toBeInTheDocument();
  });
});
