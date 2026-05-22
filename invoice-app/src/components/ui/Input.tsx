import React from 'react';
import { cn } from '../../lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, leftIcon, ...rest }, ref) => {
    if (leftIcon) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            {leftIcon}
          </span>
          <input
            ref={ref}
            className={cn('ui-input pl-10', invalid && 'border-red-300 focus:border-red-400 focus:ring-red-100', className)}
            {...rest}
          />
        </div>
      );
    }
    return (
      <input
        ref={ref}
        className={cn('ui-input', invalid && 'border-red-300 focus:border-red-400 focus:ring-red-100', className)}
        {...rest}
      />
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn('ui-textarea', invalid && 'border-red-300 focus:border-red-400 focus:ring-red-100', className)}
      {...rest}
    />
  )
);
Textarea.displayName = 'Textarea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn('ui-select', invalid && 'border-red-300 focus:border-red-400 focus:ring-red-100', className)}
      {...rest}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className, ...rest }) => (
  <label className={cn('ui-label', className)} {...rest} />
);
