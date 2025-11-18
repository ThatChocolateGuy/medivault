import { useState, useEffect } from 'react';
import { Package2, AlertCircle } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { SearchBar } from '../components/common/SearchBar';
import { EmptyState } from '../components/common/EmptyState';
import { ItemCard } from '../components/items/ItemCard';
import { type NavItem } from '../components/layout/BottomNav';
import { type InventoryItem } from '../lib/db';
import { getAllItems, searchItems, getLowStockItems } from '../lib/db/operations';

interface HomePageProps {
  onNavigate: (item: NavItem) => void;
  onItemClick: (item: InventoryItem) => void;
}

export function HomePage({ onNavigate, onItemClick }: HomePageProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load items
  useEffect(() => {
    loadItems();
    loadLowStockCount();
  }, []);

  const loadItems = async () => {
    try {
      const allItems = await getAllItems();
      setItems(allItems);
      setFilteredItems(allItems);
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

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setFilteredItems(items);
      return;
    }

    try {
      const results = await searchItems(query);
      setFilteredItems(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
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

      {/* Items list */}
      {filteredItems.length === 0 ? (
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
          {filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={() => onItemClick(item)}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}
