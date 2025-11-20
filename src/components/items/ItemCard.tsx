import { MapPin, Package, AlertCircle } from 'lucide-react';
import { type InventoryItem } from '../../lib/db';
import { cn, formatRelativeTime } from '../../lib/utils';

interface ItemCardProps {
  item: InventoryItem;
  onClick?: () => void;
  className?: string;
}

export function ItemCard({ item, onClick, className }: ItemCardProps) {
  const isLowStock = item.minQuantity !== undefined && item.quantity <= item.minQuantity;
  const hasPhoto = item.photos && item.photos.length > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-4 active:bg-gray-50 transition-colors cursor-pointer',
        className
      )}
    >
      <div className="flex gap-3">
        {/* Photo thumbnail */}
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
          {hasPhoto ? (
            <img
              src={item.photos[0]}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
            {isLowStock && (
              <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded">
                <AlertCircle className="w-3.5 h-3.5" aria-label="Low stock" />
                Low Stock
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mb-2 text-sm">
            <span className={cn(
              'flex items-center gap-1.5 font-semibold',
              isLowStock ? 'text-red-600' : 'text-gray-900'
            )}>
              <Package className="w-4 h-4" />
              {item.quantity}
            </span>
            <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-medium">
              {item.category}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{item.location}</span>
            </div>
            <span>•</span>
            <span>{formatRelativeTime(item.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
