import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface OptionGroup {
  label: string;
  options: Option[];
}

interface MultiSelectProps {
  options: (Option | OptionGroup)[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  className?: string;
}

function isOptionGroup(item: Option | OptionGroup): item is OptionGroup {
  return 'options' in item;
}

export function MultiSelect({ options, selectedValues, onChange, placeholder, className = '' }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    }

    const allOptions: Option[] = [];
    options.forEach(item => {
      if (isOptionGroup(item)) {
        allOptions.push(...item.options);
      } else {
        allOptions.push(item);
      }
    });

    const selectedLabels = selectedValues
      .map(val => allOptions.find(opt => opt.value === val)?.label)
      .filter(Boolean);

    if (selectedLabels.length <= 2) {
      return selectedLabels.join(', ');
    }
    return `${selectedLabels.length} selected`;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-left bg-white hover:border-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
      >
        <span className={selectedValues.length === 0 ? 'text-slate-500' : 'text-slate-900'}>
          {getDisplayText()}
        </span>
        <div className="flex items-center gap-1">
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="hover:bg-slate-100 rounded p-0.5"
            >
              <X className="w-3 h-3 text-slate-500" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {options.map((item, index) => {
            if (isOptionGroup(item)) {
              return (
                <div key={index}>
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-200">
                    {item.label}
                  </div>
                  {item.options.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleOption(option.value)}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="text-slate-900">{option.label}</span>
                      {selectedValues.includes(option.value) && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              );
            } else {
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => toggleOption(item.value)}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center justify-between"
                >
                  <span className="text-slate-900">{item.label}</span>
                  {selectedValues.includes(item.value) && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
