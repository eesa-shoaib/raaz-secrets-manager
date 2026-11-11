import React from 'react';

interface SearchInputProps {
    value: string;
    onChange: (nextValue: string) => void;
    onClear?: () => void;
    placeholder: string;
    ariaLabel: string;
    className?: string;
}

export function SearchInput({
    value,
    onChange,
    onClear,
    placeholder,
    ariaLabel,
    className = 'w-full sm:w-64',
}: SearchInputProps) {
    const handleClear = () => {
        onChange('');
        onClear?.();
    };

    return (
        <div className={`relative flex items-center ${className}`}>
            <svg
                aria-hidden="true"
                className="pointer-events-none absolute left-3 h-4 w-4 text-base-content/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.04 6.04a7.5 7.5 0 0 0 10.61 10.61Z"
                />
            </svg>
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={ariaLabel}
                className="input input-bordered h-9 min-h-9 w-full rounded-xl border-base-300 bg-base-200 pl-9 pr-8 font-ui text-sm text-base-content placeholder:text-base-content/45 focus:border-primary focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
            />
            {value && (
                <button
                    type="button"
                    onClick={handleClear}
                    aria-label="Clear search"
                    title="Clear search"
                    className="btn btn-ghost btn-xs btn-circle absolute right-1.5 h-6 w-6 min-h-6 text-base-content/60 hover:bg-base-300/70 hover:text-base-content"
                >
                    <svg
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18 18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            )}
        </div>
    );
}

export default SearchInput;
