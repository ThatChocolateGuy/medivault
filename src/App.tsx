import { useState, useEffect } from 'react';
import { type NavItem } from './components/layout/BottomNav';
import { HomePage } from './pages/HomePage';
import { AddItemPage } from './pages/AddItemPage';
import { ScannerPage } from './pages/ScannerPage';
import { SettingsPage } from './pages/SettingsPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { initializeDatabase, deduplicateDatabase, type InventoryItem } from './lib/db';

function App() {
  const [currentPage, setCurrentPage] = useState<NavItem>('home');
  const [initialized, setInitialized] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // Initialize database on mount
  useEffect(() => {
    initializeDatabase()
      .then(() => deduplicateDatabase())
      .then(() => {
        setInitialized(true);
        console.log('Database initialized successfully');
      })
      .catch((error) => {
        console.error('Failed to initialize database:', error);
        alert('Failed to initialize app. Please refresh the page.');
      });
  }, []);

  const handleNavigate = (item: NavItem) => {
    setCurrentPage(item);
    setSelectedItemId(null); // Clear selected item when navigating
  };

  const handleItemClick = (item: InventoryItem) => {
    if (item.id) {
      setSelectedItemId(item.id);
    }
  };

  const handleBackFromDetail = () => {
    setSelectedItemId(null);
  };

  const handleAddItemSuccess = () => {
    // Refresh home page after adding item
    setCurrentPage('home');
  };

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show item detail page if an item is selected
  if (selectedItemId !== null) {
    return (
      <ItemDetailPage
        itemId={selectedItemId}
        onNavigate={handleNavigate}
        onBack={handleBackFromDetail}
      />
    );
  }

  return (
    <>
      {currentPage === 'home' && (
        <HomePage onNavigate={handleNavigate} onItemClick={handleItemClick} />
      )}
      {currentPage === 'scan' && <ScannerPage onNavigate={handleNavigate} />}
      {currentPage === 'add' && (
        <AddItemPage onNavigate={handleNavigate} onSuccess={handleAddItemSuccess} />
      )}
      {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
    </>
  );
}

export default App;
