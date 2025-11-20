import { X, Check } from 'lucide-react';
import { Button } from '../common/Button';

export interface FilterOptions {
  categories: string[];
  locations: string[];
  stockStatus: 'all' | 'low' | 'normal';
}

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableCategories: string[];
  availableLocations: string[];
}

export function FilterPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  availableCategories,
  availableLocations,
}: FilterPanelProps) {
  if (!isOpen) return null;

  const handleCategoryToggle = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handleLocationToggle = (location: string) => {
    const newLocations = filters.locations.includes(location)
      ? filters.locations.filter((l) => l !== location)
      : [...filters.locations, location];
    onFiltersChange({ ...filters, locations: newLocations });
  };

  const handleStockStatusChange = (status: 'all' | 'low' | 'normal') => {
    onFiltersChange({ ...filters, stockStatus: status });
  };

  const handleClearAll = () => {
    onFiltersChange({
      categories: [],
      locations: [],
      stockStatus: 'all',
    });
  };

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.locations.length > 0 ||
    filters.stockStatus !== 'all';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Stock Status */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Stock Status</h3>
            <div className="space-y-2">
              {[
                { value: 'all' as const, label: 'All Items' },
                { value: 'low' as const, label: 'Low Stock Only' },
                { value: 'normal' as const, label: 'Normal Stock Only' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStockStatusChange(option.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${
                    filters.stockStatus === option.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span
                    className={`font-medium ${
                      filters.stockStatus === option.value
                        ? 'text-primary-900'
                        : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                  </span>
                  {filters.stockStatus === option.value && (
                    <Check className="w-5 h-5 text-primary-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          {availableCategories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Categories ({filters.categories.length} selected)
              </h3>
              <div className="space-y-2">
                {availableCategories.map((category) => {
                  const isSelected = filters.categories.includes(category);
                  return (
                    <button
                      key={category}
                      onClick={() => handleCategoryToggle(category)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span
                        className={`font-medium ${
                          isSelected ? 'text-primary-900' : 'text-gray-700'
                        }`}
                      >
                        {category}
                      </span>
                      {isSelected && (
                        <Check className="w-5 h-5 text-primary-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Locations */}
          {availableLocations.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Locations ({filters.locations.length} selected)
              </h3>
              <div className="space-y-2">
                {availableLocations.map((location) => {
                  const isSelected = filters.locations.includes(location);
                  return (
                    <button
                      key={location}
                      onClick={() => handleLocationToggle(location)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span
                        className={`font-medium ${
                          isSelected ? 'text-primary-900' : 'text-gray-700'
                        }`}
                      >
                        {location}
                      </span>
                      {isSelected && (
                        <Check className="w-5 h-5 text-primary-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 space-y-2 bg-white">
          <Button
            onClick={onClose}
            variant="primary"
            fullWidth
          >
            Show Results
          </Button>
          {hasActiveFilters && (
            <Button
              onClick={handleClearAll}
              variant="secondary"
              fullWidth
            >
              Clear All Filters
            </Button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
