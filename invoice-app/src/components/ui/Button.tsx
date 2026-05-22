import React from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'sm' | 'md' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:   'ui-btn-primary',
  secondary: 'ui-btn-secondary',
  ghost:     'ui-btn-ghost',
  danger:    'ui-btn-danger',
  success:   'ui-btn-success',
  outline:   'ui-btn ui-btn-secondary',
};

const sizeClasses: Record<Size, string> = {
  sm:   'ui-btn-sm',
  md:   '',
  icon: 'ui-btn-icon',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(variantClasses[variant], sizeClasses[size], className)}
        {...rest}
      >
        {isLoading && (
          <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        )}
        {!isLoading && leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);
Button.displayName = 'Button';
