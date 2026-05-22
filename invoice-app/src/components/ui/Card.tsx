import React from 'react';
import { cn } from '../../lib/cn';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export const Card: React.FC<DivProps> = ({ className, ...rest }) => (
  <div className={cn('ui-card', className)} {...rest} />
);

export const CardHeader: React.FC<DivProps> = ({ className, ...rest }) => (
  <div className={cn('px-5 sm:px-6 py-4 border-b border-slate-100', className)} {...rest} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...rest }) => (
  <h3 className={cn('text-base sm:text-lg font-semibold text-slate-900 tracking-tight', className)} {...rest} />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...rest }) => (
  <p className={cn('text-sm text-slate-500 mt-0.5', className)} {...rest} />
);

export const CardContent: React.FC<DivProps> = ({ className, ...rest }) => (
  <div className={cn('px-5 sm:px-6 py-5', className)} {...rest} />
);

export const CardFooter: React.FC<DivProps> = ({ className, ...rest }) => (
  <div className={cn('px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl', className)} {...rest} />
);
