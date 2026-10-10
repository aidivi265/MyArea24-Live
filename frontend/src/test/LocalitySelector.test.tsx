import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalitySelector } from '../components/LocalitySelector';
import type { LocalityOption } from '../types/intelligence';

const mockLocalities: LocalityOption[] = [
  { id: 'delhi-aiims-ring-road', name: 'Delhi AIIMS Ring Road', state: 'Delhi', latitude: 28.5672, longitude: 77.2100, coverage_status: 'Active Pilot' },
  { id: 'delhi-connaught-place', name: 'Delhi Connaught Place', state: 'Delhi', latitude: 28.6304, longitude: 77.2177, coverage_status: 'Active Pilot' },
  { id: 'bengaluru-silk-board', name: 'Bengaluru Silk Board', state: 'Karnataka', latitude: 12.9176, longitude: 77.6233, coverage_status: 'Active Pilot' },
];

describe('LocalitySelector Component', () => {
  it('renders all pilot zone option and localities with state badges', () => {
    const handleSelectArea = vi.fn();
    render(
      <LocalitySelector
        localities={mockLocalities}
        selectedArea=""
        onSelectArea={handleSelectArea}
      />
    );

    expect(screen.getByText('All Active Pilot Zones')).toBeInTheDocument();
    expect(screen.getByText('Delhi AIIMS Ring Road')).toBeInTheDocument();
    expect(screen.getByText('Delhi Connaught Place')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru Silk Board')).toBeInTheDocument();
    expect(screen.getByText(/Coverage currently active for pilot corridors/i)).toBeInTheDocument();
  });

  it('highlights the selected area and allows switching', () => {
    const handleSelectArea = vi.fn();
    render(
      <LocalitySelector
        localities={mockLocalities}
        selectedArea="Delhi Connaught Place"
        onSelectArea={handleSelectArea}
      />
    );

    const cpButton = screen.getByRole('radio', { name: /Delhi Connaught Place/i });
    expect(cpButton).toHaveAttribute('aria-checked', 'true');

    const aiimsButton = screen.getByRole('radio', { name: /Delhi AIIMS Ring Road/i });
    expect(aiimsButton).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(aiimsButton);
    expect(handleSelectArea).toHaveBeenCalledWith('Delhi AIIMS Ring Road');
  });

  it('selects all pilot zones when clicking All pill', () => {
    const handleSelectArea = vi.fn();
    render(
      <LocalitySelector
        localities={mockLocalities}
        selectedArea="Delhi AIIMS Ring Road"
        onSelectArea={handleSelectArea}
      />
    );

    const allButton = screen.getByRole('radio', { name: /All Active Pilot Zones/i });
    fireEvent.click(allButton);

    expect(handleSelectArea).toHaveBeenCalledWith('');
  });
});
