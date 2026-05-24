import React from 'react';
import { Badge } from '../ui/Badge';

export const MainProductBadge: React.FC = () => (
  <Badge tone="primary" className="text-[10px] uppercase tracking-wide font-semibold">
    Main product
  </Badge>
);

export const SubProductBadge: React.FC = () => (
  <Badge tone="neutral" className="text-[10px] uppercase tracking-wide">
    Sub product
  </Badge>
);

export const BillableBadge: React.FC<{ billable?: boolean }> = ({ billable = true }) =>
  billable ? (
    <Badge tone="success" className="text-[10px]">Billable</Badge>
  ) : (
    <Badge tone="neutral" className="text-[10px]">Non-billable</Badge>
  );
