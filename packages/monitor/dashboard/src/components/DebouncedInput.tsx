import { useState, useEffect } from 'react';

interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

/**
 * Input component with built-in debouncing for filter inputs.
 * Prevents excessive API calls while typing.
 */
export function DebouncedInput({
  value: externalValue,
  onChange,
  placeholder,
  className,
  debounceMs = 300
}: DebouncedInputProps) {
  const [internalValue, setInternalValue] = useState(externalValue);

  // Sync internal state when external value changes (e.g., reset)
  useEffect(() => {
    setInternalValue(externalValue);
  }, [externalValue]);

  // Debounce the onChange callback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (internalValue !== externalValue) {
        onChange(internalValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [internalValue, debounceMs, onChange, externalValue]);

  return (
    <input
      type="text"
      value={internalValue}
      onChange={(e) => setInternalValue(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}
