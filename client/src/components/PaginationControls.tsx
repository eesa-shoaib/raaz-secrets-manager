import React from 'react';

export interface PaginationControlsProps {
    hasPrevious: boolean;
    hasNext: boolean;
    onPrevious: () => void;
    onNext: () => void;
    pageNumber: number;
    itemCount: number;
    isFetching?: boolean;
    noun?: string;
}

export function PaginationControls({
    hasPrevious,
    hasNext,
    onPrevious,
    onNext,
    pageNumber,
    itemCount,
    isFetching = false,
    noun = 'items',
}: PaginationControlsProps) {
    if (!hasPrevious && !hasNext && itemCount === 0) {
        return null;
    }

    return (
        <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm font-ui text-base-content/70"
        >
            <div>
                Showing <span className="font-semibold text-base-content">{itemCount}</span>{' '}
                {noun} (Page <span className="font-semibold text-base-content">{pageNumber}</span>)
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onPrevious}
                    disabled={!hasPrevious || isFetching}
                    className="btn btn-sm btn-ghost border border-base-300 rounded-xl disabled:opacity-40"
                >
                    Previous
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    disabled={!hasNext || isFetching}
                    className="btn btn-sm btn-ghost border border-base-300 rounded-xl disabled:opacity-40"
                >
                    Next
                </button>
            </div>
        </nav>
    );
}

export default PaginationControls;
