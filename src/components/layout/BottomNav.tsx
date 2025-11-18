import { Home, ScanBarcode, Plus, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

export type NavItem = 'home' | 'scan' | 'add' | 'settings';

interface BottomNavProps {
  activeItem: NavItem;
  onNavigate: (item: NavItem) => void;
  className?: string;
}

export function BottomNav({ activeItem, onNavigate, className }: BottomNavProps) {
  const navItems = [
    { id: 'home' as NavItem, icon: Home, label: 'Home' },
    { id: 'scan' as NavItem, icon: ScanBarcode, label: 'Scan' },
    { id: 'add' as NavItem, icon: Plus, label: 'Add' },
    { id: 'settings' as NavItem, icon: Settings, label: 'Settings' },
  ];

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-bottom',
        className
      )}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 px-3 rounded-lg transition-colors',
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-600 active:bg-gray-100'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={cn(
                  'w-6 h-6',
                  isActive && 'fill-primary-600'
                )}
              />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
