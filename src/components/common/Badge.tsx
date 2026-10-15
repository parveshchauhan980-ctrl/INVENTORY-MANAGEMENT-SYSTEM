import React from 'react';

interface BadgeProps {
  status?: string | null;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const safeStatus = (status || 'unknown').toString();
  const normalized = safeStatus.toLowerCase();
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  let config = {
    bg: 'bg-slate-800 text-slate-300 border-slate-700',
    dot: 'bg-slate-400',
    label: safeStatus
  };

  switch (normalized) {
    case 'in_stock':
      config = {
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-400',
        label: 'In Stock'
      };
      break;
    case 'low_stock':
      config = {
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        dot: 'bg-amber-400 animate-pulse',
        label: 'Low Stock'
      };
      break;
    case 'out_of_stock':
      config = {
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        dot: 'bg-rose-500',
        label: 'Out of Stock'
      };
      break;
    case 'received':
    case 'completed':
    case 'paid':
    case 'active':
      config = {
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-400',
        label: normalized === 'received' ? 'Received' : normalized === 'paid' ? 'Paid' : normalized === 'completed' ? 'Completed' : 'Active'
      };
      break;
    case 'pending':
    case 'partial':
      config = {
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        dot: 'bg-amber-400',
        label: normalized === 'partial' ? 'Partial' : 'Pending'
      };
      break;
    case 'cancelled':
    case 'inactive':
      config = {
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        dot: 'bg-rose-500',
        label: normalized === 'cancelled' ? 'Cancelled' : 'Inactive'
      };
      break;
    case 'admin':
      config = {
        bg: 'bg-purple-500/15 text-purple-300 border-purple-500/40 font-semibold',
        dot: 'bg-purple-400',
        label: 'Administrator'
      };
      break;
    case 'staff':
      config = {
        bg: 'bg-blue-500/15 text-blue-300 border-blue-500/40 font-medium',
        dot: 'bg-blue-400',
        label: 'Staff Member'
      };
      break;
    case 'purchase':
      config = {
        bg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
        dot: 'bg-cyan-400',
        label: 'Purchase'
      };
      break;
    case 'sale':
      config = {
        bg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
        dot: 'bg-indigo-400',
        label: 'Sale'
      };
      break;
    case 'adjustment_in':
    case 'adjustment_out':
    case 'damage':
    case 'return':
      config = {
        bg: 'bg-slate-700/50 text-slate-300 border-slate-600',
        dot: 'bg-slate-400',
        label: normalized.replace('_', ' ').toUpperCase()
      };
      break;
    default:
      config = {
        bg: 'bg-slate-800 text-slate-300 border-slate-700',
        dot: 'bg-slate-400',
        label: safeStatus
      };
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClasses} ${config.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
};
