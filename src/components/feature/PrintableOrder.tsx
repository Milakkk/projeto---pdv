import { Order } from '../../types';

interface PrintableOrderProps {
  order: Order;
  categoryMap: Record<string, string>; // NOVO PROP
}

// Função auxiliar para extrair opções obrigatórias (agora com nome do grupo)
const extractRequiredOptions = (observations: string | undefined): string[] => {
    if (!observations) return [];
    return observations
        .split(', ')
        .filter(p => p.startsWith('[OBRIGATÓRIO]'))
        .map(p => p.replace('[OBRIGATÓRIO]', '').trim());
};

// Função auxiliar para extrair observações opcionais/customizadas
const extractOptionalObservations = (observations: string | undefined): string[] => {
    if (!observations) return [];
    return observations
        .split(', ')
        .filter(p => !p.startsWith('[OBRIGATÓRIO]'))
        .map(p => p.trim())
        .filter(p => p.length > 0);
};

// Componente que define o layout do recibo
export default function PrintableOrder({ order, categoryMap }: PrintableOrderProps) {
  const { pin, password, total, items, paymentMethod, amountPaid, changeAmount, createdAt } = order;
  
  const displayChange = typeof changeAmount === 'number' && changeAmount > 0.01;
  const isCashPayment = paymentMethod.toLowerCase().includes('dinheiro') || (order.paymentBreakdown && Object.keys(order.paymentBreakdown).some(m => m.toLowerCase().includes('dinheiro')));

  return (
    // Usamos classes Tailwind para simular um recibo estreito e limpo
    <div className="p-2 text-xs font-mono w-[300px] mx-auto">
      <div className="text-center mb-2 border-b border-dashed border-gray-700 pb-1">
        <h1 className="text-lg font-bold mb-0">RECIBO DE PEDIDO</h1>
        <p className="text-[10px]">Data: {new Date(createdAt).toLocaleString('pt-BR')}</p>
        <p className="text-[10px]">Atendente: {order.createdBy}</p>
      </div>

      <div className="mb-2">
        <p className="text-xl font-extrabold text-center mb-1">PEDIDO #{pin}</p>
        <p className="text-3xl font-extrabold text-center bg-gray-200 py-1 rounded">SENHA: {password}</p>
      </div>

      <div className="mb-2 border-b border-dashed border-gray-700 pb-1">
        <div className="flex justify-between font-bold mb-1">
          <span>ITEM</span>
          <span>TOTAL</span>
        </div>
        {items.map((item, index) => {
          const categoryName = categoryMap[item.menuItem.categoryId] || 'Sem Categoria';
          const requiredOptions = extractRequiredOptions(item.observations);
          const optionalObservations = extractOptionalObservations(item.observations);
          
          return (
            <div key={index} className="mb-1">
              <div className="flex justify-between">
                {/* MUDANÇA: Colocando a categoria antes do nome do item na mesma linha */}
                <span>
                  <span className="text-[10px] italic mr-1">[{categoryName}]</span>
                  {item.quantity}x {item.menuItem.name}
                </span>
                <span>R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
              </div>
              
              {/* Opções Obrigatórias - Renderizando cada uma em uma nova linha */}
              {requiredOptions.length > 0 && (
                <div className="ml-2">
                  {requiredOptions.map((option, i) => (
                    <p key={i} className="text-[10px] required-option">
                      • {option}
                    </p>
                  ))}
                </div>
              )}
              
              {/* Observações Opcionais - Renderizando cada uma em uma nova linha */}
              {optionalObservations.length > 0 && (
                <div className="ml-2">
                  {optionalObservations.map((obs, i) => (
                    <p key={i} className="text-[10px] italic">
                      Obs: {obs}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-2 space-y-1">
        <div className="flex justify-between font-bold text-base">
          <span>TOTAL A PAGAR:</span>
          <span>R$ {total.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between text-xs">
          <span>Forma de Pagamento:</span>
          <span>{paymentMethod}</span>
        </div>
        
        {isCashPayment && amountPaid !== undefined && (
          <div className="flex justify-between text-xs">
            <span>Valor Pago:</span>
            <span>R$ {amountPaid.toFixed(2)}</span>
          </div>
        )}
        
        {displayChange && (
          <div className="flex justify-between font-bold text-base border-t border-dashed border-gray-700 pt-1">
            <span>TROCO:</span>
            <span>R$ {changeAmount.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Removido o bloco de agradecimento */}
    </div>
  );
}