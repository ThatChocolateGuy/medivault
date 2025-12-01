import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Plus, Edit2, Trash2, MapPin } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { type Location } from '../../lib/db';
import {
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  checkLocationInUse,
} from '../../lib/db/operations';

interface LocationManagerProps {
  onClose: () => void;
}

type FormMode = 'add' | 'edit' | 'delete' | null;

export function LocationManager({ onClose }: LocationManagerProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<FormMode>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  // Cleanup success message timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    }
  }, [successMessage]);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const data = await getAllLocations();
      setLocations(data);
    } catch (err) {
      console.error('Failed to load locations:', err);
      setError('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setMode('add');
    setFormData({ name: '', description: '' });
    setError(null);
  };

  const handleEdit = (location: Location) => {
    setMode('edit');
    setSelectedLocation(location);
    setFormData({
      name: location.name,
      description: location.description || '',
    });
    setError(null);
  };

  const handleDeleteClick = async (location: Location) => {
    setMode('delete');
    setSelectedLocation(location);
    setError(null);

    // Check if location is in use
    try {
      const { count } = await checkLocationInUse(location.name);
      setItemCount(count);
    } catch (err) {
      console.error('Failed to check location usage:', err);
      setItemCount(0);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (mode === 'add') {
        await createLocation(formData.name, formData.description || undefined);
        setSuccessMessage('Location added successfully');
      } else if (mode === 'edit' && selectedLocation) {
        await updateLocation(selectedLocation.id!, {
          name: formData.name,
          description: formData.description || undefined,
        });

        // Check if name changed for success message
        if (formData.name !== selectedLocation.name) {
          setSuccessMessage(`Location renamed. Items updated automatically.`);
        } else {
          setSuccessMessage('Location updated successfully');
        }
      }

      await loadLocations();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save location');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLocation) return;

    setError(null);
    setIsSaving(true);

    try {
      await deleteLocation(selectedLocation.id!);
      setSuccessMessage('Location deleted successfully');
      await loadLocations();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete location');
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setMode(null);
    setSelectedLocation(null);
    setFormData({ name: '', description: '' });
    setError(null);
    setIsSaving(false);
  };

  if (loading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Manage Locations" maxWidth="lg">
        <div className="text-center py-8">
          <p className="text-gray-500">Loading locations...</p>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title="Manage Locations" maxWidth="lg">
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
              {locations.length} {locations.length === 1 ? 'location' : 'locations'}
            </p>
            <Button onClick={handleAdd} variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          </div>

          {/* Locations List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {locations.map((location) => (
              <div
                key={location.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 flex-1">
                  <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{location.name}</p>
                    {location.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{location.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(location)}
                    className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Edit location"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(location)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="Delete location"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {locations.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No locations yet. Add your first location!
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
          title={mode === 'add' ? 'Add Location' : 'Edit Location'}
          maxWidth="sm"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-800 rounded-lg text-sm">{error}</div>
            )}

            <Input
              label="Location Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Shelf A"
              maxLength={50}
            />

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Top shelf in storage room"
                maxLength={200}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
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
      {mode === 'delete' && selectedLocation && (
        <Modal
          isOpen={true}
          onClose={handleClose}
          title="Delete Location"
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
                  <p className="font-medium">Cannot delete location</p>
                  <p className="text-sm mt-1">
                    {itemCount} {itemCount === 1 ? 'item is' : 'items are'} using this location.
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  Please reassign or delete the items at "{selectedLocation.name}" before deleting
                  this location.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-900">
                  Are you sure you want to delete <strong>{selectedLocation.name}</strong>?
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
