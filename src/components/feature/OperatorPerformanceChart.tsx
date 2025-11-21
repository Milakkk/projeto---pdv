import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface OperatorData {
  name: string;
  averageTime: number; // Tempo médio em minutos
  ordersCount: number;
}

interface OperatorPerformanceChartProps {
  data: OperatorData[];
}

// Formatação para o Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const avgTime = payload.find((p: any) => p.dataKey === 'averageTime');
    const orders = payload.find((p: any) => p.dataKey === 'ordersCount');
    
    return (
      <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg text-sm">
        <p className="font-bold text-gray-900 mb-1">Operador: {label}</p>
        {avgTime && (
          <p className="text-blue-600">
            Tempo Médio: <span className="font-medium">{avgTime.value.toFixed(1)} min</span>
          </p>
        )}
        {orders && (
          <p className="text-gray-600">
            Itens Processados: <span className="font-medium">{orders.value}</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function OperatorPerformanceChart({ data }: OperatorPerformanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <i className="ri-user-line text-4xl mb-4"></i>
        <p>Nenhum dado de performance de operador disponível.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" stroke="#6b7280" />
          <YAxis 
            yAxisId="left" 
            orientation="left" 
            stroke="#3b82f6" 
            label={{ value: 'Tempo Médio (min)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          
          <Bar yAxisId="left" dataKey="averageTime" name="Tempo Médio (min)" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}