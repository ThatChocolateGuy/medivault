import { useState, useEffect, useMemo } from 'react';
import { Package2, AlertCircle } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { SearchBar } from '../components/common/SearchBar';
import { EmptyState } from '../components/common/EmptyState';
import { ItemCard } from '../components/items/ItemCard';
import { FilterBar, type SortOption } from '../components/items/FilterBar';
import { FilterPanel, type FilterOptions } from '../components/items/FilterPanel';
import { type NavItem } from '../components/layout/BottomNav';
import { type InventoryItem } from '../lib/db';
import { getAllItems, getLowStockItems, getAllCategories, getAllLocations } from '../lib/db/operations';

interface HomePageProps {
  onNavigate: (item: NavItem) => void;
  onItemClick: (item: InventoryItem) => void;
}

export function HomePage({ onNavigate, onItemClick }: HomePageProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc');
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    locations: [],
    stockStatus: 'all',
  });
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);

  // Load items
  useEffect(() => {
    loadItems();
    loadLowStockCount();
    loadFilterOptions();
  }, []);

  const loadItems = async () => {
    try {
      const allItems = await getAllItems();
      setItems(allItems);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLowStockCount = async () => {
    try {
      const lowStock = await getLowStockItems();
      setLowStockCount(lowStock.length);
    } catch (error) {
      console.error('Failed to load low stock count:', error);
    }
  };

  const loadFilterOptions = async () => {
    try {
      const [categories, locations] = await Promise.all([
        getAllCategories(),
        getAllLocations(),
      ]);
      setAvailableCategories(categories.map((c) => c.name));
      setAvailableLocations(locations.map((l) => l.name));
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Apply sorting and filtering with useMemo for performance
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.barcode?.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.location.toLowerCase().includes(query) ||
          item.notes?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (filters.categories.length > 0) {
      result = result.filter((item) => filters.categories.includes(item.category));
    }

    // Apply location filter
    if (filters.locations.length > 0) {
      result = result.filter((item) => filters.locations.includes(item.location));
    }

    // Apply stock status filter
    if (filters.stockStatus === 'low') {
      result = result.filter(
        (item) => item.minQuantity !== undefined && item.quantity <= item.minQuantity
      );
    } else if (filters.stockStatus === 'normal') {
      result = result.filter(
        (item) => item.minQuantity === undefined || item.quantity > item.minQuantity
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'quantity-asc':
          return a.quantity - b.quantity;
        case 'quantity-desc':
          return b.quantity - a.quantity;
        case 'updated-asc':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'updated-desc':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'stock-status': {
          const aIsLow = a.minQuantity !== undefined && a.quantity <= a.minQuantity;
          const bIsLow = b.minQuantity !== undefined && b.quantity <= b.minQuantity;
          if (aIsLow && !bIsLow) return -1;
          if (!aIsLow && bIsLow) return 1;
          return 0;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [items, searchQuery, filters, sortBy]);

  // Calculate active filter count
  const activeFilterCount =
    filters.categories.length +
    filters.locations.length +
    (filters.stockStatus !== 'all' ? 1 : 0);

  const handleClearFilters = () => {
    setFilters({
      categories: [],
      locations: [],
      stockStatus: 'all',
    });
  };

  if (loading) {
    return (
      <Layout
        title="Inventory"
        activeNav="home"
        onNavigate={onNavigate}
        showNotifications
        notificationCount={lowStockCount}
      >
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Inventory"
      activeNav="home"
      onNavigate={onNavigate}
      showNotifications
      notificationCount={lowStockCount}
    >
      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-red-900">Low Stock Alert</p>
            <p className="text-red-700">
              {lowStockCount} {lowStockCount === 1 ? 'item is' : 'items are'} running low
            </p>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="px-4 py-4">
        <SearchBar
          onSearch={handleSearch}
          placeholder="Search items..."
        />
      </div>

      {/* Filter and sort bar */}
      <FilterBar
        sortBy={sortBy}
        onSortChange={setSortBy}
        onFilterClick={() => setIsFilterPanelOpen(true)}
        activeFilterCount={activeFilterCount}
        onClearFilters={handleClearFilters}
      />

      {/* Items list */}
      {filteredAndSortedItems.length === 0 ? (
        <EmptyState
          icon={Package2}
          title={searchQuery ? 'No items found' : 'No items yet'}
          description={
            searchQuery
              ? 'Try a different search term'
              : 'Add your first item to get started'
          }
          action={
            searchQuery
              ? undefined
              : {
                  label: 'Add Item',
                  onClick: () => onNavigate('add'),
                }
          }
        />
      ) : (
        <div className="px-4 pb-4 space-y-3">
          {filteredAndSortedItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={() => onItemClick(item)}
            />
          ))}
        </div>
      )}

      {/* Filter panel */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        availableCategories={availableCategories}
        availableLocations={availableLocations}
      />
    </Layout>
  );
}
