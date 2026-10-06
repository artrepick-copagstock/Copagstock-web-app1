import { FC, useState, useRef, useEffect, useMemo, KeyboardEvent } from 'react';
import { Material } from '../types';
import { Search, ChevronDown, Check, X, Boxes } from 'lucide-react';

interface SearchableMaterialSelectProps {
  materials: Material[];
  selectedId: string;
  onSelect: (materialId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const SearchableMaterialSelect: FC<SearchableMaterialSelectProps> = ({
  materials,
  selectedId,
  onSelect,
  placeholder = 'พิมพ์ค้นหาชื่อ หรือรหัสพัสดุ...',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Current selected material
  const selectedMaterial = useMemo(() => {
    return materials.find(m => m.id === selectedId);
  }, [materials, selectedId]);

  // Filter materials based on search query
  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) {
      return materials;
    }
    const q = searchQuery.toLowerCase().trim();
    return materials.filter(m => 
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.category && m.category.toLowerCase().includes(q))
    );
  }, [materials, searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredMaterials.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Handle open
  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearchQuery('');
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 10);
  };

  // Handle select
  const handleSelect = (mat: Material) => {
    onSelect(mat.id);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredMaterials.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredMaterials.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredMaterials[highlightedIndex]) {
          handleSelect(filteredMaterials[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        break;
    }
  };

  const displayText = selectedMaterial
    ? `[${selectedMaterial.id}] ${selectedMaterial.name} (คงเหลือ: ${selectedMaterial.currentStock} ${selectedMaterial.unit})`
    : 'เลือกพัสดุ...';

  return (
    <div ref={containerRef} className="relative w-full min-w-[280px]">
      {/* Search Input Box */}
      <div 
        onClick={handleOpen}
        className={`flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg text-xs cursor-pointer transition ${
          isOpen 
            ? 'border-amber-500 ring-2 ring-amber-500/20 bg-white dark:bg-slate-800' 
            : 'border-slate-200 dark:border-slate-700 hover:border-amber-400'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
          <Search className={`w-3.5 h-3.5 shrink-0 ${isOpen ? 'text-amber-500' : 'text-slate-400'}`} />
          
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 font-medium"
              autoFocus
            />
          ) : (
            <span className={`truncate text-xs font-medium ${selectedMaterial ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
              {displayText}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isOpen && searchQuery && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-amber-500' : ''}`} />
        </div>
      </div>

      {/* Dropdown Floating Results Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[70] overflow-hidden">
          {/* Header count info */}
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>ผลการค้นหา {filteredMaterials.length} รายการ</span>
            <span className="text-amber-600 dark:text-amber-400">ใช้ ↑ ↓ เพื่อเลือก และ Enter เพื่อยืนยัน</span>
          </div>

          {/* List of items */}
          <ul 
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 scrollbar-thin text-left"
          >
            {filteredMaterials.slice(0, 80).map((mat, idx) => {
              const isSelected = mat.id === selectedId;
              const isHighlighted = idx === highlightedIndex;

              return (
                <li
                  key={mat.id}
                  onClick={() => handleSelect(mat)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2 cursor-pointer transition flex items-center justify-between gap-2.5 ${
                    isHighlighted 
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100' 
                      : isSelected 
                      ? 'bg-slate-50 dark:bg-slate-900/40' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* ID Badge */}
                    <span className="px-1.5 py-0.5 bg-slate-900 dark:bg-slate-700 text-amber-300 rounded text-[10px] font-mono font-bold shrink-0">
                      {mat.id}
                    </span>

                    {/* Name & Category info */}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
                        {mat.name}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="truncate">{mat.category}</span>
                        <span>•</span>
                        <span className={`font-medium ${
                          mat.currentStock <= 0 
                            ? 'text-rose-500' 
                            : mat.currentStock <= 10 
                            ? 'text-amber-500' 
                            : 'text-emerald-500'
                        }`}>
                          คงเหลือ: {mat.currentStock} {mat.unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price & Selection Check */}
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      ฿{mat.unitPrice}
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                  </div>
                </li>
              );
            })}

            {filteredMaterials.length === 0 && (
              <li className="p-5 text-center text-slate-400 text-xs">
                <Boxes className="w-6 h-6 mx-auto mb-1 text-slate-300 dark:text-slate-600 stroke-1" />
                <span>ไม่พบพัสดุที่ตรงกับ "{searchQuery}"</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
