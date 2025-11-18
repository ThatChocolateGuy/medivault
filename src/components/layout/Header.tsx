import { Menu, Search, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
  onSearchClick?: () => void;
  showNotifications?: boolean;
  notificationCount?: number;
  className?: string;
}

export function Header({
  title,
  onMenuClick,
  onSearchClick,
  showNotifications = false,
  notificationCount = 0,
  className,
}: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full bg-white border-b border-gray-200 safe-top',
        className
      )}
    >
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left section */}
        <div className="flex items-center gap-2">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="p-2 -ml-2 rounded-lg active:bg-gray-100"
              aria-label="Menu"
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
          )}
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1">
          {onSearchClick && (
            <button
              onClick={onSearchClick}
              className="p-2 rounded-lg active:bg-gray-100"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-gray-700" />
            </button>
          )}

          {showNotifications && (
            <button className="relative p-2 rounded-lg active:bg-gray-100" aria-label="Notifications">
              <Bell className="w-5 h-5 text-gray-700" />
              {notificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
