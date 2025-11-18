import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { ScanBarcode, Search, Plus } from 'lucide-react';
import { type NavItem } from '../components/layout/BottomNav';
import { getItemByBarcode } from '../lib/db/operations';
import { type InventoryItem } from '../lib/db';

interface ScannerPageProps {
  onNavigate: (item: NavItem) => void;
  onItemFound?: (item: InventoryItem) => void;
}

export function ScannerPage({ onNavigate, onItemFound }: ScannerPageProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [searching, setSearching] = useState(false);

  const handleStartScan = () => {
    setIsScanning(true);
    setScannedCode(null);
    setFoundItem(null);
  };

  const handleBarcodeDetected = async (code: string) => {
    setScannedCode(code);
    setIsScanning(false);
    setSearching(true);

    try {
      // Search for item by barcode
      const item = await getItemByBarcode(code);
      if (item) {
        setFoundItem(item);
        onItemFound?.(item);
      } else {
        setFoundItem(null);
      }
    } catch (error) {
      console.error('Error searching for item:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddNew = () => {
    // Navigate to add page with pre-filled barcode
    // For now, just navigate to add page
    onNavigate('add');
  };

  return (
    <Layout title="Scan Barcode" activeNav="scan" onNavigate={onNavigate}>
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
        {!scannedCode ? (
          // Initial state - ready to scan
          <div className="text-center">
            <div className="flex items-center justify-center w-24 h-24 mx-auto mb-6 rounded-full bg-primary-100">
              <ScanBarcode className="w-12 h-12 text-primary-600" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-gray-900">Barcode Scanner</h2>
            <p className="mb-8 text-gray-600 max-w-sm">
              Scan product barcodes to quickly find or add items to your inventory
            </p>
            <Button onClick={handleStartScan} variant="primary" size="lg" className="mb-4">
              <ScanBarcode className="w-5 h-5 mr-2" />
              Start Scanning
            </Button>
            <p className="mt-4 text-sm text-gray-500">
              Camera access required. Works best in good lighting.
            </p>
          </div>
        ) : searching ? (
          // Searching state
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600">Searching for item...</p>
            <p className="mt-2 text-sm text-gray-500 font-mono">{scannedCode}</p>
          </div>
        ) : foundItem ? (
          // Item found
          <div className="w-full max-w-md">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-green-100">
              <Search className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-center text-gray-900">Item Found!</h3>
            <p className="mb-6 text-sm text-center text-gray-500 font-mono">{scannedCode}</p>

            {/* Item card */}
            <div className="p-4 mb-6 bg-white border border-gray-200 rounded-lg">
              <h4 className="mb-2 text-lg font-semibold text-gray-900">{foundItem.name}</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Quantity:</span> {foundItem.quantity}
                </p>
                <p>
                  <span className="font-medium">Category:</span> {foundItem.category}
                </p>
                <p>
                  <span className="font-medium">Location:</span> {foundItem.location}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button onClick={() => onNavigate('home')} variant="primary" fullWidth>
                View in Inventory
              </Button>
              <Button onClick={handleStartScan} variant="secondary" fullWidth>
                Scan Another
              </Button>
            </div>
          </div>
        ) : (
          // Item not found
          <div className="w-full max-w-md text-center">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100">
              <Plus className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-gray-900">Item Not Found</h3>
            <p className="mb-2 text-gray-600">
              No item found with this barcode in your inventory
            </p>
            <p className="mb-6 text-sm text-gray-500 font-mono">{scannedCode}</p>

            <div className="space-y-3">
              <Button onClick={handleAddNew} variant="primary" fullWidth>
                <Plus className="w-5 h-5 mr-2" />
                Add New Item
              </Button>
              <Button onClick={handleStartScan} variant="secondary" fullWidth>
                Scan Another
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Scanner overlay */}
      {isScanning && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setIsScanning(false)}
        />
      )}
    </Layout>
  );
}
