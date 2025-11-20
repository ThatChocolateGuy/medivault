import { type ReactNode } from 'react';
import { Header } from './Header';
import { BottomNav, type NavItem } from './BottomNav';
import { cn } from '../../lib/utils';

interface LayoutProps {
  children: ReactNode;
  title: string;
  activeNav: NavItem;
  onNavigate: (item: NavItem) => void;
  onSearchClick?: () => void;
  onBackClick?: () => void;
  showNotifications?: boolean;
  notificationCount?: number;
  className?: string;
}

export function Layout({
  children,
  title,
  activeNav,
  onNavigate,
  onSearchClick,
  onBackClick,
  showNotifications,
  notificationCount,
  className,
}: LayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header
        title={title}
        onSearchClick={onSearchClick}
        onBackClick={onBackClick}
        showNotifications={showNotifications}
        notificationCount={notificationCount}
      />

      <main className={cn('flex-1 overflow-y-auto pb-16', className)}>{children}</main>

      <BottomNav activeItem={activeNav} onNavigate={onNavigate} />
    </div>
  );
}
