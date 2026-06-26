import React from 'react';
import { cn } from '../../lib/cn';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

const toneClasses: Record<Tone, string> = {
  success: 'ui-badge-success',
  warning: 'ui-badge-warning',
  danger:  'ui-badge-danger',
  info:    'ui-badge-info',
  neutral: 'ui-badge-neutral',
  primary: 'ui-badge bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', dot, className, children, ...rest }) => (
  <span className={cn(toneClasses[tone], className)} {...rest}>
    {dot && <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
    {children}
  </span>
);

/** Map invoice status string to a badge tone */
export const InvoiceStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, Tone> = {
    Paid: 'success',
    'Partially Paid': 'warning',
    Sent: 'info',
    Draft: 'neutral',
    Unpaid: 'danger',
  };
  return (
    <Badge tone={map[status] ?? 'danger'} dot>
      {status}
    </Badge>
  );
};

/** Map work completion status to a badge tone */
export const WorkStatusBadge: React.FC<{ workStatus: string }> = ({ workStatus }) => {
  const map: Record<string, Tone> = {
    Pending: 'warning',
    'In Progress': 'info',
    Completed: 'success',
  };
  return (
    <Badge tone={map[workStatus] ?? 'neutral'} dot>
      {workStatus}
    </Badge>
  );
};
