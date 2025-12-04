import { useState, useEffect, type FormEvent } from 'react';
import { Camera } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { type NavItem } from '../components/layout/BottomNav';
import { createItem, getAllCategories, getAllLocations } from '../lib/db/operations';
import { compressImage } from '../lib/utils';

interface AddItemPageProps {
  onNavigate: (item: NavItem) => void;
  onSuccess?: () => void;
  initialBarcode?: string;
}

export function AddItemPage({ onNavigate, onSuccess, initialBarcode }: AddItemPageProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photosProcessing, setPhotosProcessing] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    quantity: 1,
    minQuantity: 0,
    category: '',
    location: '',
    notes: '',
  });

  useEffect(() => {
    loadOptions();
  }, []);

  // Pre-fill barcode if provided from scanner
  useEffect(() => {
    if (initialBarcode) {
      setFormData((prev) => ({ ...prev, barcode: initialBarcode }));
    }
  }, [initialBarcode]);

  const loadOptions = async () => {
    const [cats, locs] = await Promise.all([getAllCategories(), getAllLocations()]);
    setCategories(cats.map((c) => c.name));
    setLocations(locs.map((l) => l.name));

    // Set defaults
    if (cats.length > 0) setFormData((prev) => ({ ...prev, category: cats[0].name }));
    if (locs.length > 0) setFormData((prev) => ({ ...prev, location: locs[0].name }));
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📸 handlePhotoCapture called');
    const files = e.target.files;
    if (!files || files.length === 0) {
      console.log('⏭️ No files selected');
      return;
    }

    console.log(`📸 Processing ${files.length} photo(s)`);
    const input = e.target;
    setPhotosProcessing(true);

    try {
      const compressed = await Promise.all(
        Array.from(files).map(async (file) => {
          console.log(`🔄 Compressing ${file.name} (${(file.size / 1024).toFixed(2)}KB)`);
          const result = await compressImage(file);
          console.log(`✅ Compressed ${file.name}`);
          return result;
        })
      );
      setPhotos((prev) => {
        console.log(`📸 Adding ${compressed.length} photos to collection (${prev.length} existing)`);
        return [...prev, ...compressed];
      });
      console.log('✅ All photos processed successfully');
    } catch (error) {
      console.error('❌ Failed to process photos:', error);
      alert(`Failed to process photos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPhotosProcessing(false);
      // Clear file input to allow re-selection of same files
      if (input) input.value = '';
      console.log('🧹 Photo processing complete, input cleared');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    // Block submission if photos are still being processed
    if (photosProcessing) {
      console.warn('Photos are still processing, blocking submission');
      return;
    }

    setLoading(true);
    try {
      await createItem({
        ...formData,
        quantity: Number(formData.quantity),
        minQuantity: Number(formData.minQuantity),
        photos,
      });

      // Reset form
      setFormData({
        name: '',
        barcode: '',
        quantity: 1,
        minQuantity: 0,
        category: categories[0] || '',
        location: locations[0] || '',
        notes: '',
      });
      setPhotos([]);

      onSuccess?.();
      onNavigate('home');
    } catch (error) {
      console.error('Failed to create item:', error);
      alert('Failed to create item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Add Item" activeNav="add" onNavigate={onNavigate}>
      <form onSubmit={handleSubmit} className="p-4 space-y-4" noValidate>
        {/* Photo upload */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">Photos</label>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}

            <div className="flex-shrink-0">
              <label
                className="flex items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer active:bg-gray-50"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handlePhotoCapture}
                  onClick={(e) => e.stopPropagation()}
                  className="hidden"
                />
                <Camera className="w-8 h-8 text-gray-400" />
              </label>
            </div>
          </div>
        </div>

        <Input
          name="name"
          label="Item Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Bandages"
        />

        <Input
          name="barcode"
          label="Barcode (optional)"
          value={formData.barcode}
          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
          placeholder="Scan or enter barcode"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            name="quantity"
            label="Quantity"
            type="number"
            min="0"
            required
            value={formData.quantity}
            onChange={(e) => {
              const value = e.target.value === '' ? 0 : parseInt(e.target.value);
              setFormData({ ...formData, quantity: isNaN(value) ? 0 : value });
            }}
          />

          <Input
            name="minQuantity"
            label="Min Quantity"
            type="number"
            min="0"
            value={formData.minQuantity}
            onChange={(e) => {
              const value = e.target.value === '' ? 0 : parseInt(e.target.value);
              setFormData({ ...formData, minQuantity: isNaN(value) ? 0 : value });
            }}
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            name="category"
            required
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="input"
            disabled={categories.length === 0}
          >
            {categories.length === 0 ? (
              <option value="">Loading...</option>
            ) : (
              categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Location <span className="text-red-500">*</span>
          </label>
          <select
            name="location"
            required
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="input"
            disabled={locations.length === 0}
          >
            {locations.length === 0 ? (
              <option value="">Loading...</option>
            ) : (
              locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="pt-4 space-y-3">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading || photosProcessing}
          >
            {photosProcessing ? 'Processing photos...' : 'Add Item'}
          </Button>
          <Button type="button" variant="secondary" fullWidth onClick={() => onNavigate('home')}>
            Cancel
          </Button>
        </div>
      </form>
    </Layout>
  );
}
