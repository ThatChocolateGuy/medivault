import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { type NavItem } from '../components/layout/BottomNav';
import { Cloud, Bell, Database, Info, FolderOpen, MapPin, ChevronRight } from 'lucide-react';
import { CategoryManager } from '../components/settings/CategoryManager';
import { LocationManager } from '../components/settings/LocationManager';

interface SettingsPageProps {
  onNavigate: (item: NavItem) => void;
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showLocationManager, setShowLocationManager] = useState(false);

  return (
    <Layout title="Settings" activeNav="settings" onNavigate={onNavigate}>
      <div className="p-4 space-y-6">
        {/* Sync Settings */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase">Sync</h2>
          <div className="bg-white rounded-lg border border-gray-200 divide-y">
            <button className="flex items-center gap-3 w-full p-4 text-left active:bg-gray-50">
              <Cloud className="w-5 h-5 text-gray-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Google Sheets Sync</p>
                <p className="text-sm text-gray-500">Connect your Google account</p>
              </div>
              <span className="text-xs text-gray-400">Not connected</span>
            </button>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase">Notifications</h2>
          <div className="bg-white rounded-lg border border-gray-200">
            <button className="flex items-center gap-3 w-full p-4 text-left active:bg-gray-50">
              <Bell className="w-5 h-5 text-gray-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Low Stock Alerts</p>
                <p className="text-sm text-gray-500">Get notified when items are low</p>
              </div>
              <div className="w-12 h-6 bg-primary-600 rounded-full relative">
                <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full" />
              </div>
            </button>
          </div>
        </section>

        {/* Organization */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase">Organization</h2>
          <div className="bg-white rounded-lg border border-gray-200 divide-y">
            <button
              onClick={() => setShowCategoryManager(true)}
              className="flex items-center gap-3 w-full p-4 text-left active:bg-gray-50"
            >
              <FolderOpen className="w-5 h-5 text-gray-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Manage Categories</p>
                <p className="text-sm text-gray-500">Add, edit, or remove categories</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={() => setShowLocationManager(true)}
              className="flex items-center gap-3 w-full p-4 text-left active:bg-gray-50"
            >
              <MapPin className="w-5 h-5 text-gray-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Manage Locations</p>
                <p className="text-sm text-gray-500">Add, edit, or remove locations</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </section>

        {/* Data */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase">Data</h2>
          <div className="bg-white rounded-lg border border-gray-200 divide-y">
            <button className="flex items-center gap-3 w-full p-4 text-left active:bg-gray-50">
              <Database className="w-5 h-5 text-gray-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Export Data</p>
                <p className="text-sm text-gray-500">Download as CSV</p>
              </div>
            </button>
            <button className="flex items-center gap-3 w-full p-4 text-left text-red-600 active:bg-red-50">
              <Database className="w-5 h-5" />
              <div className="flex-1">
                <p className="font-medium">Clear All Data</p>
                <p className="text-sm text-red-500">This cannot be undone</p>
              </div>
            </button>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase">About</h2>
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-3 p-4">
              <Info className="w-5 h-5 text-gray-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Version</p>
                <p className="text-sm text-gray-500">1.0.0</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <CategoryManager onClose={() => setShowCategoryManager(false)} />
      )}

      {/* Location Manager Modal */}
      {showLocationManager && (
        <LocationManager onClose={() => setShowLocationManager(false)} />
      )}
    </Layout>
  );
}
