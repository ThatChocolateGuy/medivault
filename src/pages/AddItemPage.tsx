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
}

export function AddItemPage({ onNavigate, onSuccess }: AddItemPageProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

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

  const loadOptions = async () => {
    const [cats, locs] = await Promise.all([getAllCategories(), getAllLocations()]);
    setCategories(cats.map((c) => c.name));
    setLocations(locs.map((l) => l.name));

    // Set defaults
    if (cats.length > 0) setFormData((prev) => ({ ...prev, category: cats[0].name }));
    if (locs.length > 0) setFormData((prev) => ({ ...prev, location: locs[0].name }));
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    try {
      const compressed = await Promise.all(
        Array.from(files).map((file) => compressImage(file))
      );
      setPhotos((prev) => [...prev, ...compressed]);
    } catch (error) {
      console.error('Failed to process photos:', error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

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
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Photo upload */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">Photos</label>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}

            <label className="flex-shrink-0 flex items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer active:bg-gray-50">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoCapture}
                className="hidden"
              />
              <Camera className="w-8 h-8 text-gray-400" />
            </label>
          </div>
        </div>

        <Input
          label="Item Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Bandages"
        />

        <Input
          label="Barcode (optional)"
          value={formData.barcode}
          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
          placeholder="Scan or enter barcode"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Quantity"
            type="number"
            min="0"
            required
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
          />

          <Input
            label="Min Quantity"
            type="number"
            min="0"
            value={formData.minQuantity}
            onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="input"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Location <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="input"
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="pt-4 space-y-3">
          <Button type="submit" variant="primary" fullWidth loading={loading}>
            Add Item
          </Button>
          <Button type="button" variant="secondary" fullWidth onClick={() => onNavigate('home')}>
            Cancel
          </Button>
        </div>
      </form>
    </Layout>
  );
}
