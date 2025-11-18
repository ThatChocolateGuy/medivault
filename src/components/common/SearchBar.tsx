import { Search, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ onSearch, placeholder = 'Search...', className }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced search
    timeoutRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className={cn('relative', className)}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <Search className="w-5 h-5 text-gray-400" />
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 pl-12 pr-12 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />

      {query && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full active:bg-gray-100"
          aria-label="Clear search"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      )}
    </div>
  );
}
