import { useState, useEffect, type FormEvent } from 'react';
import { Edit2, Trash2, Package, MapPin, Calendar, Camera, X, Minus, Plus } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { type NavItem } from '../components/layout/BottomNav';
import { type InventoryItem } from '../lib/db';
import {
  getItemById,
  updateItem,
  deleteItem,
  adjustQuantity,
  getAllCategories,
  getAllLocations,
} from '../lib/db/operations';
import { formatRelativeTime, compressImage } from '../lib/utils';

interface ItemDetailPageProps {
  itemId: number;
  onNavigate: (item: NavItem) => void;
  onBack: () => void;
}

export function ItemDetailPage({ itemId, onNavigate, onBack }: ItemDetailPageProps) {
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    quantity: 0,
    minQuantity: 0,
    category: '',
    location: '',
    notes: '',
    photos: [] as string[],
  });

  useEffect(() => {
    loadItem();
    loadOptions();
  }, [itemId]);

  const loadItem = async () => {
    setLoading(true);
    try {
      const loadedItem = await getItemById(itemId);
      if (loadedItem) {
        setItem(loadedItem);
        setFormData({
          name: loadedItem.name,
          barcode: loadedItem.barcode || '',
          quantity: loadedItem.quantity,
          minQuantity: loadedItem.minQuantity || 0,
          category: loadedItem.category,
          location: loadedItem.location,
          notes: loadedItem.notes || '',
          photos: loadedItem.photos || [],
        });
      }
    } catch (error) {
      console.error('Failed to load item:', error);
      alert('Failed to load item');
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    const [cats, locs] = await Promise.all([getAllCategories(), getAllLocations()]);
    setCategories(cats.map((c) => c.name));
    setLocations(locs.map((l) => l.name));
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form to original values
    if (item) {
      setFormData({
        name: item.name,
        barcode: item.barcode || '',
        quantity: item.quantity,
        minQuantity: item.minQuantity || 0,
        category: item.category,
        location: item.location,
        notes: item.notes || '',
        photos: item.photos || [],
      });
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    try {
      const compressed = await Promise.all(
        Array.from(files).map((file) => compressImage(file))
      );
      setFormData((prev) => ({ ...prev, photos: [...prev.photos, ...compressed] }));
    } catch (error) {
      console.error('Failed to process photos:', error);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSaving(true);
    try {
      await updateItem(itemId, {
        name: formData.name,
        barcode: formData.barcode || undefined,
        quantity: Number(formData.quantity),
        minQuantity: Number(formData.minQuantity),
        category: formData.category,
        location: formData.location,
        notes: formData.notes || undefined,
        photos: formData.photos,
      });

      await loadItem();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update item:', error);
      alert('Failed to update item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteItem(itemId);
      onBack();
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item. Please try again.');
    }
  };

  const handleQuantityAdjust = async (delta: number) => {
    if (!item) return;

    setIsAdjusting(true);
    setAdjustError(null);

    try {
      await adjustQuantity(itemId, delta);
      await loadItem(); // Reload to get updated quantity
    } catch (error) {
      console.error('Failed to adjust quantity:', error);
      setAdjustError('Failed to adjust quantity. Please try again.');
      setTimeout(() => setAdjustError(null), 3000); // Clear error after 3 seconds
    } finally {
      setIsAdjusting(false);
    }
  };

  if (loading || !item) {
    return (
      <Layout title="Item Details" activeNav="home" onNavigate={onNavigate} onBackClick={onBack}>
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const isLowStock = item.minQuantity !== undefined && item.quantity <= item.minQuantity;

  return (
    <Layout
      title={isEditing ? 'Edit Item' : 'Item Details'}
      activeNav="home"
      onNavigate={onNavigate}
      onBackClick={onBack}
    >
      {isEditing ? (
        // Edit Mode
        <form onSubmit={handleSave} className="p-4 space-y-4">
          {/* Photos */}
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">Photos</label>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {formData.photos.map((photo, idx) => (
                <div key={idx} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                  <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <label className="flex-shrink-0 flex items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer active:bg-gray-50">
                <input
                  type="file"
                  accept="image/*"
                  capture
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
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                setFormData({ ...formData, quantity: isNaN(value) ? 0 : value });
              }}
            />

            <Input
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
            <Button type="submit" variant="primary" fullWidth loading={isSaving}>
              Save Changes
            </Button>
            <Button type="button" variant="secondary" fullWidth onClick={handleCancelEdit}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        // View Mode
        <div className="p-4 space-y-6">
          {/* Photos Gallery */}
          {item.photos && item.photos.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {item.photos.map((photo, idx) => (
                <div key={idx} className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
                  <img src={photo} alt={`${item.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {/* Item Info Card */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-bold text-gray-900">{item.name}</h2>
                {isLowStock && (
                  <span className="flex-shrink-0 px-3 py-1 bg-red-50 text-red-600 text-sm font-medium rounded">
                    Low Stock
                  </span>
                )}
              </div>
              {item.barcode && (
                <p className="mt-2 text-sm text-gray-500 font-mono">{item.barcode}</p>
              )}
            </div>

            <div className="p-4 space-y-4">
              {/* Quantity with +/- controls */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-gray-400" />
                  <p className="text-sm text-gray-500">Quantity</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleQuantityAdjust(-1)}
                    disabled={isAdjusting || item.quantity === 0}
                    className="flex items-center justify-center w-11 h-11 rounded-lg border-2 border-gray-300 bg-white text-gray-700 active:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold text-gray-900">{item.quantity}</p>
                    {item.minQuantity !== undefined && (
                      <p className="text-xs text-gray-500 mt-1">(min: {item.minQuantity})</p>
                    )}
                  </div>

                  <button
                    onClick={() => handleQuantityAdjust(1)}
                    disabled={isAdjusting}
                    className="flex items-center justify-center w-11 h-11 rounded-lg border-2 border-primary-500 bg-primary-50 text-primary-700 active:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {adjustError && (
                  <p className="mt-2 text-sm text-red-600">{adjustError}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Category</p>
                <span className="inline-block px-3 py-1 bg-primary-50 text-primary-700 rounded text-sm font-medium">
                  {item.category}
                </span>
              </div>

              {/* Location */}
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium text-gray-900">{item.location}</p>
                </div>
              </div>

              {/* Notes */}
              {item.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-700">{item.notes}</p>
                </div>
              )}

              {/* Timestamps */}
              <div className="pt-4 border-t border-gray-200 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>Created {formatRelativeTime(item.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>Updated {formatRelativeTime(item.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button variant="primary" fullWidth onClick={handleEdit}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Item
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Item
            </Button>
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Item?</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete "{item.name}"? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
