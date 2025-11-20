import { SlidersHorizontal, ArrowUpDown, X } from 'lucide-react';

export type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'quantity-asc'
  | 'quantity-desc'
  | 'updated-desc'
  | 'updated-asc'
  | 'stock-status';

interface FilterBarProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  onFilterClick: () => void;
  activeFilterCount: number;
  onClearFilters: () => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'updated-desc', label: 'Recently Updated' },
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'quantity-asc', label: 'Quantity (Low to High)' },
  { value: 'quantity-desc', label: 'Quantity (High to Low)' },
  { value: 'stock-status', label: 'Low Stock First' },
  { value: 'updated-asc', label: 'Least Recently Updated' },
];

export function FilterBar({
  sortBy,
  onSortChange,
  onFilterClick,
  activeFilterCount,
  onClearFilters,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
      {/* Sort dropdown */}
      <div className="flex-1">
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.75rem center',
            paddingRight: '2.5rem',
          }}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              <ArrowUpDown className="w-4 h-4 inline mr-2" />
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filter button */}
      <button
        onClick={onFilterClick}
        className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg transition-colors ${
          activeFilterCount > 0
            ? 'bg-primary-50 text-primary-700 border-primary-300 hover:bg-primary-100'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span className="hidden sm:inline">Filters</span>
        {activeFilterCount > 0 && (
          <span className="flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary-600 rounded-full">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Clear filters button */}
      {activeFilterCount > 0 && (
        <button
          onClick={onClearFilters}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Clear all filters"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
