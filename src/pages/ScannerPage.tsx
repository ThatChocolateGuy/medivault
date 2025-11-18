import { Layout } from '../components/layout/Layout';
import { EmptyState } from '../components/common/EmptyState';
import { ScanBarcode } from 'lucide-react';
import { type NavItem } from '../components/layout/BottomNav';

interface ScannerPageProps {
  onNavigate: (item: NavItem) => void;
}

export function ScannerPage({ onNavigate }: ScannerPageProps) {
  return (
    <Layout title="Scan Barcode" activeNav="scan" onNavigate={onNavigate}>
      <EmptyState
        icon={ScanBarcode}
        title="Barcode Scanner"
        description="Barcode scanning will be implemented next. For now, you can manually enter barcodes when adding items."
        action={{
          label: 'Add Item Manually',
          onClick: () => onNavigate('add'),
        }}
      />
    </Layout>
  );
}
