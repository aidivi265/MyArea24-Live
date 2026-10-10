import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from '../components/FilterBar';

describe('FilterBar Component', () => {
  it('renders filter controls and results count', () => {
    const handleFilterChange = vi.fn();
    render(
      <FilterBar
        filters={{}}
        onFilterChange={handleFilterChange}
        totalResults={5}
      />
    );

    expect(screen.getByLabelText(/Signal Architecture/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Severity Level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Evidence Strength/i)).toBeInTheDocument();
    expect(screen.getByText(/5/i)).toBeInTheDocument();
    expect(screen.getByText(/verified insights/i)).toBeInTheDocument();
  });

  it('triggers onFilterChange when selecting severity', () => {
    const handleFilterChange = vi.fn();
    render(
      <FilterBar
        filters={{}}
        onFilterChange={handleFilterChange}
        totalResults={5}
      />
    );

    const severitySelect = screen.getByLabelText(/Severity Level/i);
    fireEvent.change(severitySelect, { target: { value: 'severe' } });

    expect(handleFilterChange).toHaveBeenCalledTimes(1);
    expect(handleFilterChange).toHaveBeenCalledWith({ severity: 'severe' });
  });

  it('shows clear filters button when filter is active and resets when clicked', () => {
    const handleFilterChange = vi.fn();
    render(
      <FilterBar
        filters={{ severity: 'high', area: 'Delhi AIIMS Ring Road' }}
        onFilterChange={handleFilterChange}
        totalResults={2}
      />
    );

    const clearBtn = screen.getByRole('button', { name: /Reset all filters/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    expect(handleFilterChange).toHaveBeenCalledWith({
      area: 'Delhi AIIMS Ring Road',
    });
  });
});
