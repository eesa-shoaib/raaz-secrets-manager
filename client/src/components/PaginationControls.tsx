import React from 'react';

export interface PaginationControlsProps {
    hasPrevious: boolean;
    hasNext: boolean;
    onPrevious: () => void;
    onNext: () => void;
    onFirstPage?: () => void;
    pageNumber: number;
    totalPages?: number;
    itemCount: number;
    isFetching?: boolean;
    noun?: string;
}

export function PaginationControls({
    hasPrevious,
    hasNext,
    onPrevious,
    onNext,
    onFirstPage,
    pageNumber,
    totalPages,
    itemCount,
    isFetching = false,
}: PaginationControlsProps) {
    if (!hasPrevious && !hasNext && itemCount === 0) {
        return null;
    }
    const hasTotal = totalPages !== undefined && Number.isFinite(totalPages) && totalPages > 0;

    return (
        <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm font-ui text-base-content/70"
        >
            <div
                role="status"
                className="inline-flex items-baseline gap-1.5 tabular-nums"
                aria-label={hasTotal ? `Page ${pageNumber} of ${totalPages}` : `Page ${pageNumber}`}
                aria-live="polite"
            >
                <span className="font-semibold text-base-content">{pageNumber}</span>
                {hasTotal && (
                    <>
                        <span aria-hidden="true" className="text-base-content/30">
                            /
                        </span>
                        <span>{totalPages}</span>
                    </>
                )}
            </div>
            <div className="flex items-center gap-2">
                {onFirstPage && (
                    <button
                        type="button"
                        onClick={onFirstPage}
                        disabled={!hasPrevious || isFetching}
                        aria-label="First page"
                        title="First page"
                        className="btn btn-sm btn-square h-9 btn-ghost border border-base-300 rounded-xl text-primary hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-primary disabled:text-base-content/30"
                    >
                        <svg
                            aria-hidden="true"
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M5 5v14M19 5l-7 7 7 7" />
                        </svg>
                    </button>
                )}
                <button
                    type="button"
                    onClick={onPrevious}
                    disabled={!hasPrevious || isFetching}
                    aria-label="Previous"
                    title="Previous"
                    className="btn btn-sm btn-square h-9 btn-ghost border border-base-300 rounded-xl text-primary hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-primary disabled:text-base-content/30"
                >
                    <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m15 5-7 7 7 7" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    disabled={!hasNext || isFetching}
                    aria-label="Next"
                    title="Next"
                    className="btn btn-sm btn-square h-9 btn-ghost border border-base-300 rounded-xl text-primary hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-primary disabled:text-base-content/30"
                >
                    <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m9 5 7 7-7 7" />
                    </svg>
                </button>
            </div>
        </nav>
    );
}

export default PaginationControls;
