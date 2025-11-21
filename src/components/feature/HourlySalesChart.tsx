import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line } from 'recharts';

interface HourlyData {
  hour: string;
  orders: number;
  revenue: number;
  averageTicket: number;
}

interface HourlySalesChartProps {
  data: HourlyData[];
}

// Formatação para o Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const revenue = payload.find((p: any) => p.dataKey === 'revenue');
    const orders = payload.find((p: any) => p.dataKey === 'orders');
    const avgTicket = payload.find((p: any) => p.dataKey === 'averageTicket');
    
    return (
      <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg text-sm">
        <p className="font-bold text-gray-900 mb-1">{label}</p>
        {revenue && (
          <p className="text-amber-600">
            Faturamento: <span className="font-medium">R$ {revenue.value.toFixed(2)}</span>
          </p>
        )}
        {avgTicket && (
          <p className="text-purple-600">
            Ticket Médio: <span className="font-medium">R$ {avgTicket.value.toFixed(2)}</span>
          </p>
        )}
        {orders && (
          <p className="text-blue-600">
            Pedidos: <span className="font-medium">{orders.value}</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function HourlySalesChart({ data }: HourlySalesChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <i className="ri-bar-chart-line text-4xl mb-4"></i>
        <p>Nenhum dado de vendas por hora disponível.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          {/* YAxis Left for Revenue and Average Ticket (R$) */}
          <YAxis yAxisId="left" orientation="left" stroke="#f59e0b" tickFormatter={(value) => `R$ ${value.toFixed(0)}`} />
          {/* YAxis Right for Orders (Count) */}
          <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" />
          <XAxis dataKey="hour" stroke="#6b7280" />
          <Tooltip content={<CustomTooltip />} />
          {/* Legend is now interactive by default in Recharts */}
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          
          {/* Bars */}
          <Bar yAxisId="left" dataKey="revenue" name="Faturamento (R$)" fill="#f59e0b" />
          <Bar yAxisId="right" dataKey="orders" name="Pedidos" fill="#3b82f6" />
          
          {/* Line for Average Ticket */}
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey="averageTicket" 
            name="Ticket Médio (R$)" 
            stroke="#9333ea" // Purple color for the line
            strokeWidth={2}
            dot={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}