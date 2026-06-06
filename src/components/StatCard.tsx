
import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'red' | 'blue' | 'green' | 'orange';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  const colorMap = {
    red: 'bg-gradient-to-r from-card-red to-card-red/80',
    blue: 'bg-gradient-to-r from-card-blue to-card-blue/80',
    green: 'bg-gradient-to-r from-card-green to-card-green/80',
    orange: 'bg-gradient-to-r from-card-orange to-card-orange/80',
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 transform hover:scale-[1.02] transition-transform">
      <div className="flex items-center">
        <div className={cn("p-6 flex items-center justify-center rounded-lg mx-2", colorMap[color])}>
          <div className="bg-white/20 p-3 rounded-lg">
            {icon}
          </div>
        </div>
        <div className="p-6 flex-1">
          <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
