import { useState, useEffect } from 'react';
import { type NavItem } from './components/layout/BottomNav';
import { HomePage } from './pages/HomePage';
import { AddItemPage } from './pages/AddItemPage';
import { ScannerPage } from './pages/ScannerPage';
import { SettingsPage } from './pages/SettingsPage';
import { initializeDatabase, type InventoryItem } from './lib/db';

function App() {
  const [currentPage, setCurrentPage] = useState<NavItem>('home');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize database on mount
  useEffect(() => {
    initializeDatabase()
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
    setSelectedItem(null);
  };

  const handleItemClick = (item: InventoryItem) => {
    setSelectedItem(item);
    // TODO: Navigate to item detail page
    console.log('Item clicked:', item);
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
