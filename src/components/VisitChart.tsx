
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar } from 'lucide-react';

interface VisitChartProps {
  title: string;
  date: string;
  data?: Array<{ name: string; value: number }>;
}

const VisitChart: React.FC<VisitChartProps> = ({ title, date, data = [] }) => {
  // Use provided data or empty array if no data available
  const chartData = data.length > 0 ? data : [];
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold uppercase text-gray-800">{title}</h2>
          <div className="flex items-center text-gray-500 gap-2">
            <Calendar size={16} />
            <span className="text-sm">{date}</span>
          </div>
        </div>
        <div className="mt-6">
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  angle={-90} 
                  textAnchor="end" 
                  height={100} 
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#4CAF50" 
                  barSize={20} 
                  radius={[4, 4, 0, 0]}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          <div className="bg-gray-100 rounded-full px-4 py-2 inline-flex items-center text-sm text-gray-700">
            <span className="w-3 h-3 rounded-full bg-primary mr-2"></span>
            Poliklinik dan Rawat Jalan
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitChart;
