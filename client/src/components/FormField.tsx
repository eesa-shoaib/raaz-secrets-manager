import React, { useId } from 'react';

interface FormFieldProps {
    label: string;
    error?: string;
    hint?: string;
    required?: boolean;
    children: (props: {
        id: string;
        'aria-invalid'?: boolean;
        'aria-describedby'?: string;
    }) => React.ReactNode;
    className?: string;
}

export function FormField({
    label,
    error,
    hint,
    required,
    children,
    className = '',
}: FormFieldProps) {
    const id = useId();
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

    return (
        <div className={`form-control w-full space-y-1.5 ${className}`}>
            <label htmlFor={id} className="label py-0 px-0.5 justify-start gap-1">
                <span className="label-text font-ui font-medium text-sm text-base-content/90">
                    {label}
                </span>
                {required && <span className="text-error text-xs">*</span>}
            </label>

            {children({
                id,
                'aria-invalid': Boolean(error),
                'aria-describedby': describedBy || undefined,
            })}

            {error ? (
                <p id={errorId} role="alert" className="text-error text-xs font-ui mt-1">
                    {error}
                </p>
            ) : hint ? (
                <p id={hintId} className="text-base-content/60 text-xs font-ui mt-1">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

export default FormField;
