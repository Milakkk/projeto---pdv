import { ReactNode, useEffect, useMemo } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import type { OrderItem, Order, Category } from '../../../types';
import { printOrder } from '../../../utils/print'; // Importando a função de impressão
import { useAuth } from '../../../context/AuthContext';
import { useLocalStorage } from '../../../hooks/useLocalStorage'; // Importando useLocalStorage
import { mockCategories } from '../../../mocks/data'; // Importando mockCategories

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: {
    pin: string;
    password: string;
    total: number;
    changeAmount?: number;
    items: OrderItem[];
    paymentMethod: string;
    // Adicionando campos necessários para a impressão (simulando o objeto Order)
    createdAt: Date;
    createdBy: string;
    amountPaid?: number;
    paymentBreakdown?: Order['paymentBreakdown'];
  } | null;
}

// Função auxiliar para separar opções obrigatórias e observações opcionais (copiada do Cart.tsx)
const parseObservations = (observationsString: string | undefined) => {
    if (!observationsString) {
        return { required: [], optional: [], custom: '' };
    }
    
    const allParts = observationsString.split(', ').map(p => p.trim()).filter(p => p.length > 0);
    
    // Modificadores Obrigatórios: [OBRIGATÓRIO] Nome do Grupo: Opção Selecionada
    const required = allParts
        .filter(p => p.startsWith('[OBRIGATÓRIO]'))
        .map(p => p.replace('[OBRIGATÓRIO]', '').trim());
        
    const optionalAndCustom = allParts.filter(p => !p.startsWith('[OBRIGATÓRIO]'));
    
    // Simplificando a extração de opcionais/customizados para exibição
    const optionalAndCustomText = optionalAndCustom.join(', ');
    
    return { required, optionalAndCustomText };
};


export default function OrderConfirmationModal({ isOpen, onClose, orderData }: OrderConfirmationModalProps) {
  // HOOKS CHAMADOS INCONDICIONALMENTE NO TOPO
  // CORREÇÃO: Usando mockCategories como fallback
  const [categories] = useLocalStorage<Category[]>('categories', mockCategories);
  const { store } = useAuth();
  const [shouldPrint, setShouldPrint] = useLocalStorage<boolean>('printOnConfirm', true);
  
  // Criar mapa de categorias (useMemo 1)
  const categoryMap = useMemo(() => {
    return categories.reduce((map, cat) => {
      map[cat.id] = cat.name;
      return map;
    }, {} as Record<string, string>);
  }, [categories]);

  // Criar um objeto Order simulado para a função de impressão (useMemo 2)
  const printableOrder: Order | null = useMemo(() => {
    if (!orderData) return null;
    
    const { pin, password, total, items, paymentMethod, createdAt, createdBy, amountPaid, changeAmount, paymentBreakdown } = orderData;
    
    return {
      id: 'temp', // ID temporário
      pin,
      password,
      total,
      items,
      paymentMethod,
      createdAt,
      createdBy,
      slaMinutes: 0, // Não relevante para o recibo
      status: 'DELIVERED', // Status simulado
      amountPaid,
      changeAmount,
      paymentBreakdown,
    };
  }, [orderData]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        if (shouldPrint && printableOrder) {
          printOrder(printableOrder, categoryMap, store?.name);
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, printableOrder, categoryMap, shouldPrint, store?.name]);

  // RETORNO CONDICIONAL DEVE VIR DEPOIS DE TODOS OS HOOKS
  if (!orderData || !printableOrder) return null;

  const { pin, password, total, changeAmount, items, paymentMethod } = orderData;
  
  // Lógica de exibição do troco, agora mais robusta:
  // Só exibe se 'changeAmount' for um número e for maior que R$ 0,01.
  const displayChange = typeof changeAmount === 'number' && changeAmount > 0.01;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pedido Finalizado com Sucesso!"
      size="md"
    >
      <div className="space-y-6 text-center">
        <div className="flex flex-col items-center justify-center">
          <i className="ri-check-double-line text-7xl text-green-600 mb-3 animate-pulse"></i>
          <h3 className="text-2xl font-extrabold text-gray-900">Pedido #{pin} Enviado!</h3>
          {/* REMOVIDO: <p className="text-gray-600 mt-1">Acompanhe o pedido pela senha na cozinha.</p> */}
        </div>

        <div className="flex items-center justify-center gap-2">
          <input type="checkbox" checked={shouldPrint} onChange={(e)=> setShouldPrint(e.target.checked)} />
          <span className="text-sm text-gray-700">Imprimir recibo agora</span>
        </div>

        {/* Detalhes Principais */}
        <div className="grid grid-cols-2 gap-4 bg-green-50 border border-green-300 rounded-xl p-5 shadow-inner">
          <div className="text-left">
            <p className="text-sm text-green-800 font-medium">Senha de Retirada:</p>
            <span className="text-3xl font-extrabold text-green-900 block mt-1">{password}</span>
          </div>
          <div className="text-right">
            <p className="text-sm text-green-800 font-medium">Valor Total:</p>
            <span className="text-3xl font-extrabold text-green-900 block mt-1">R$ {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Troco (Apenas se houver troco relevante) */}
        {displayChange && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <i className="ri-money-dollar-circle-line text-2xl text-amber-700"></i>
                <span className="text-lg font-semibold text-amber-800">Troco para o Cliente:</span>
              </div>
              <span className="text-2xl font-extrabold text-amber-800">R$ {changeAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Resumo dos Itens e Observações */}
        <div className="text-left">
          <h4 className="font-medium text-gray-900 mb-2 flex items-center">
            <i className="ri-list-check-line mr-2 text-amber-600"></i>
            Itens do Pedido:
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
            {items.map((item, index) => {
              const { required, optionalAndCustomText } = parseObservations(item.observations);
              
              return (
                <div key={index} className="border-b border-gray-200 pb-2 last:border-b-0">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-900">{item.quantity}x {item.menuItem.name}</span>
                    <span className="font-medium">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                  
                  {required.length > 0 && (
                    <div className="mt-1 text-xs text-red-600 font-medium">
                      <i className="ri-checkbox-circle-line mr-1"></i>
                      Opções: {required.join(' | ')}
                    </div>
                  )}
                  
                  {optionalAndCustomText && (
                    <div className="mt-1 text-xs text-gray-600 italic">
                      <i className="ri-information-line mr-1"></i>
                      Obs: {optionalAndCustomText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button onClick={() => { if (shouldPrint && printableOrder) { printOrder(printableOrder, categoryMap, store?.name); } onClose(); }} className="w-full" autoFocus>
            <i className="ri-printer-line mr-2"></i>
            Fechar (ENTER)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
