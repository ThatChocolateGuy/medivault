import { useState, useEffect, type FormEvent } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { type Category } from '../../lib/db';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  checkCategoryInUse,
} from '../../lib/db/operations';

interface CategoryManagerProps {
  onClose: () => void;
}

type FormMode = 'add' | 'edit' | 'delete' | null;

const COLOR_PALETTE = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#10b981' },
  { name: 'Orange', hex: '#f59e0b' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Gray', hex: '#6b7280' },
];

export function CategoryManager({ onClose }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<FormMode>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    color: COLOR_PALETTE[0].hex,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await getAllCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setMode('add');
    setFormData({ name: '', color: COLOR_PALETTE[0].hex });
    setError(null);
  };

  const handleEdit = (category: Category) => {
    setMode('edit');
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      color: category.color || COLOR_PALETTE[0].hex,
    });
    setError(null);
  };

  const handleDeleteClick = async (category: Category) => {
    setMode('delete');
    setSelectedCategory(category);
    setError(null);

    // Check if category is in use
    try {
      const { count } = await checkCategoryInUse(category.name);
      setItemCount(count);
    } catch (err) {
      console.error('Failed to check category usage:', err);
      setItemCount(0);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (mode === 'add') {
        await createCategory(formData.name, formData.color);
        setSuccessMessage('Category added successfully');
      } else if (mode === 'edit' && selectedCategory) {
        await updateCategory(selectedCategory.id!, {
          name: formData.name,
          color: formData.color,
        });

        // Check if name changed for success message
        if (formData.name !== selectedCategory.name) {
          setSuccessMessage(`Category renamed. Items updated automatically.`);
        } else {
          setSuccessMessage('Category updated successfully');
        }
      }

      await loadCategories();
      handleClose();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    setError(null);
    setIsSaving(true);

    try {
      await deleteCategory(selectedCategory.id!);
      setSuccessMessage('Category deleted successfully');
      await loadCategories();
      handleClose();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setMode(null);
    setSelectedCategory(null);
    setFormData({ name: '', color: COLOR_PALETTE[0].hex });
    setError(null);
  };

  if (loading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Manage Categories" maxWidth="lg">
        <div className="text-center py-8">
          <p className="text-gray-500">Loading categories...</p>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title="Manage Categories" maxWidth="lg">
        <div className="space-y-4">
          {/* Success Message */}
          {successMessage && (
            <div className="p-3 bg-green-50 text-green-800 rounded-lg text-sm">
              {successMessage}
            </div>
          )}

          {/* Add Button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </p>
            <Button onClick={handleAdd} variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>

          {/* Categories List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full border-2 border-gray-200"
                    style={{ backgroundColor: category.color || '#3b82f6' }}
                  />
                  <span className="font-medium text-gray-900">{category.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Edit category"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(category)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {categories.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No categories yet. Add your first category!
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Add/Edit Modal */}
      {(mode === 'add' || mode === 'edit') && (
        <Modal
          isOpen={true}
          onClose={handleClose}
          title={mode === 'add' ? 'Add Category' : 'Edit Category'}
          maxWidth="sm"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-800 rounded-lg text-sm">{error}</div>
            )}

            <Input
              label="Category Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Medications"
              maxLength={50}
            />

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Color</label>
              <div className="grid grid-cols-4 gap-3">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.hex })}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      formData.color === color.hex
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    aria-label={`Select ${color.name}`}
                  >
                    <div
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-xs text-gray-600">{color.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" onClick={handleClose} variant="secondary" fullWidth>
                Cancel
              </Button>
              <Button type="submit" variant="primary" fullWidth loading={isSaving}>
                {mode === 'add' ? 'Add' : 'Save'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {mode === 'delete' && selectedCategory && (
        <Modal
          isOpen={true}
          onClose={handleClose}
          title="Delete Category"
          maxWidth="sm"
          closeOnBackdrop={false}
        >
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-800 rounded-lg text-sm">{error}</div>
            )}

            {itemCount > 0 ? (
              <div className="space-y-3">
                <div className="p-4 bg-red-50 text-red-800 rounded-lg">
                  <p className="font-medium">Cannot delete category</p>
                  <p className="text-sm mt-1">
                    {itemCount} {itemCount === 1 ? 'item is' : 'items are'} using this category.
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  Please reassign or delete the items using "{selectedCategory.name}" before
                  deleting this category.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-900">
                  Are you sure you want to delete <strong>{selectedCategory.name}</strong>?
                </p>
                <p className="text-sm text-gray-600">This action cannot be undone.</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button onClick={handleClose} variant="secondary" fullWidth>
                Cancel
              </Button>
              {itemCount === 0 && (
                <Button
                  onClick={handleDelete}
                  variant="primary"
                  fullWidth
                  loading={isSaving}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
