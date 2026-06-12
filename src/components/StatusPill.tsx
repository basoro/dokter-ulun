import React from 'react';

import { cn } from '@/lib/utils';

type StatusPillTone =
  | 'default'
  | 'blue'
  | 'green'
  | 'amber'
  | 'red'
  | 'pink'
  | 'lime'
  | 'slate'
  | 'dark';

interface StatusPillProps {
  label: React.ReactNode;
  tone?: StatusPillTone;
  className?: string;
  onClick?: () => void;
}

const toneClasses: Record<StatusPillTone, string> = {
  default: 'bg-primary/10 text-primary',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  pink: 'bg-pink-100 text-pink-800',
  lime: 'bg-lime-100 text-lime-800',
  slate: 'bg-slate-100 text-slate-700',
  dark: 'bg-slate-800 text-white'
};

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  tone = 'default',
  className,
  onClick
}) => {
  const sharedClassName = cn(
    'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium transition-colors',
    toneClasses[tone],
    onClick && 'hover:brightness-95',
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={sharedClassName}>
        {label}
      </button>
    );
  }

  return <span className={sharedClassName}>{label}</span>;
};
