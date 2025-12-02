import { useState, useEffect, useRef, useMemo, startTransition } from 'react';
import OrderBoard from './components/OrderBoard';
import OrderList from './components/OrderList';
import OperatorManagementModal from './components/OperatorManagementModal';
import ItemsInProductionModal from './components/ItemsInProductionModal';
import KitchenSelectModal from './components/KitchenSelectModal';
import AlertModal from '../../components/base/AlertModal';
import ConfirmationModal from '../../components/base/ConfirmationModal';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useKitchens, Kitchen, useKitchenSessions } from '../../hooks/useDatabase';
import { Order, KitchenOperator, Category, ProductionUnit, OperationalSession } from '../../types';
import { useOffline } from '../../hooks/useOffline';
import Button from '../../components/base/Button';
import { mockCategories } from '../../mocks/data';
import { showSuccess } from '../../utils/toast';
import ReadyOrderTable from './components/ReadyOrderTable';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/base/Modal';
import DeliveredOrderList from './components/DeliveredOrderList';

const createProductionUnits = (quantity: number): ProductionUnit[] => {
  const units: ProductionUnit[] = [];
  for (let i = 0; i < quantity; i++) {
    units.push({
      unitId: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      unitStatus: 'PENDING',
      operatorName: undefined,
      completedObservations: [],
    });
  }
  return units;
};

export default function CozinhaPage() {
  const { user, store } = useAuth();
  const { kitchens } = useKitchens();
  const { openKitchenSession, closeKitchenSession, isKitchenOnline, getKitchenSession } = useKitchenSessions();
  
  const [orders, setOrders] = useLocalStorage<Order[]>('orders', []);
  const [operators, setOperators] = useLocalStorage<KitchenOperator[]>('kitchenOperators', []);
  const [categories] = useLocalStorage<Category[]>('categories', mockCategories);
  
  const [operationalSession] = useLocalStorage<OperationalSession | null>('currentOperationalSession', null);
  const [cashSession] = useLocalStorage<any>('currentCashSession', null);
  
  // Estados de seleção de cozinha e operador
  const [selectedKitchen, setSelectedKitchen] = useLocalStorage<Kitchen | null>('kds_selected_kitchen', null);
  const [selectedOperator, setSelectedOperator] = useLocalStorage<KitchenOperator | null>('kds_selected_operator', null);
  const [showKitchenSelectModal, setShowKitchenSelectModal] = useState(false);
  
  // Mostra o modal de seleção se não houver seleção ao montar
  useEffect(() => {
    // Aguarda um pouco para garantir que os dados foram carregados
    const timer = setTimeout(() => {
      const hasKitchens = kitchens.filter(k => k.isActive).length > 0;
      // Sempre mostra o modal se não houver seleção (mesmo sem cozinhas, para selecionar operador)
      if (!selectedKitchen && !selectedOperator) {
        setShowKitchenSelectModal(true);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [kitchens, selectedKitchen, selectedOperator]);
  
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [showItemsInProductionModal, setShowItemsInProductionModal] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [showDeliveredModal, setShowDeliveredModal] = useState(false);
  const [showCanceledModal, setShowCanceledModal] = useState(false);
  
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertModalMessage, setAlertModalMessage] = useState({ title: '', message: '', variant: 'error' as 'error' | 'info' | 'success' });
  
  const [showDeliveryConfirmation, setShowDeliveryConfirmation] = useState(false);
  const [orderToDeliver, setOrderToDeliver] = useState<Order | null>(null);
  // Checklist de entrega por item/unidade (Cozinha)
  const [deliveryUnitChecks, setDeliveryUnitChecks] = useState<Record<string, boolean>>({});
  
  const previousOrdersRef = useRef<Order[]>(orders); 
  const hasMigratedRef = useRef(false); // NOVO: Ref para controlar se a migração já foi tentada

  const isOperationalSessionOpen = useMemo(() => !!operationalSession && operationalSession.status === 'OPEN', [operationalSession]);

  // Função para verificar se um pedido pertence à cozinha selecionada
  const orderBelongsToKitchen = (order: Order) => {
    // Se não há cozinha selecionada, mostra todos os pedidos
    if (!selectedKitchen) return true;
    
    // Verifica se algum item do pedido pertence a uma categoria da cozinha selecionada
    return order.items.some(item => {
      const category = categories.find(c => c.id === item.menuItem?.categoryId);
      if (!category) return true; // Item sem categoria aparece em todas as cozinhas
      
      // Se a categoria não tem cozinhas específicas, aparece em todas
      if (!category.kitchenIds || category.kitchenIds.length === 0) return true;
      
      // Verifica se a cozinha selecionada está nas cozinhas da categoria
      return category.kitchenIds.includes(selectedKitchen.id);
    });
  };

  const activeProductionOrders = useMemo(() => {
    return orders
      .filter(order => ['NEW', 'PREPARING', 'READY'].includes(order.status))
      .filter(orderBelongsToKitchen);
  }, [orders, selectedKitchen, categories]);

  const readyOrdersList = useMemo(() => orders.filter(order => order.status === 'READY').filter(orderBelongsToKitchen), [orders, selectedKitchen, categories]);
  const deliveredOrdersList = useMemo(() => orders.filter(o => o.status === 'DELIVERED').filter(orderBelongsToKitchen), [orders, selectedKitchen, categories]);
  const canceledOrdersList = useMemo(() => orders.filter(o => o.status === 'CANCELLED'), [orders]);

  // NOVO useEffect para a lógica de migração, executado apenas uma vez na montagem
  useEffect(() => {
    if (hasMigratedRef.current) return; // Já tentou migrar, não faça novamente

    let needsUpdate = false;
    
    const migratedOrders = orders.map(order => {
      let orderNeedsUpdate = false;
      let currentOrder = order;
      
      if (!('operationalSessionId' in currentOrder) && operationalSession) {
          orderNeedsUpdate = true;
          currentOrder = { ...currentOrder, operationalSessionId: operationalSession.id };
      }
      
      const updatedItems = currentOrder.items.map(item => {
        let itemNeedsUpdate = false;
        let currentItem = item;
        
        const isUnitStructureInvalid = !currentItem.productionUnits || 
                                      currentItem.productionUnits.length === 0 ||
                                      currentItem.productionUnits.length !== currentItem.quantity;
                                      
        if (isUnitStructureInvalid) {
          itemNeedsUpdate = true;
          
          const oldStatus = (currentItem as any).itemStatus; 
          const newUnits = createProductionUnits(currentItem.quantity);
          
          if (oldStatus === 'READY') {
             newUnits.forEach(unit => unit.unitStatus = 'READY');
          }
          
          currentItem = { 
            ...currentItem, 
            productionUnits: newUnits,
            operatorName: undefined, 
            itemStatus: undefined, 
          };
        }
        
        const unitsWithObsMigration = currentItem.productionUnits.map(unit => {
            let updatedUnit = unit;
            let unitNeedsUpdate = false;
            
            if (!('completedObservations' in unit)) {
                unitNeedsUpdate = true;
                updatedUnit = { ...updatedUnit, completedObservations: [] };
            }
            if (!('completedAt' in unit)) {
                unitNeedsUpdate = true;
                updatedUnit = { ...updatedUnit, completedAt: undefined };
            }
            
            if (unitNeedsUpdate) {
                itemNeedsUpdate = true;
                return updatedUnit;
            }
            return unit;
        });
        
        if (itemNeedsUpdate) {
            orderNeedsUpdate = true;
            return { ...currentItem, productionUnits: unitsWithObsMigration };
        }
        
        return currentItem;
      });
      
      if (orderNeedsUpdate) {
        needsUpdate = true;
        return { ...currentOrder, items: updatedItems };
      }
      return currentOrder;
    });
    
    if (needsUpdate) {
      setOrders(migratedOrders); 
      console.log('Dados de pedidos migrados para nova estrutura de ProductionUnits.');
    }
    
    hasMigratedRef.current = true; // Marca que a migração foi tentada
  }, [orders, setOrders, operationalSession]); // Dependências para a migração

  // useEffect para monitorar pedidos prontos e disparar notificação (mantido separado)
  useEffect(() => {
    const previousOrders = previousOrdersRef.current;
    
    orders.forEach(currentOrder => {
      const previousOrder = previousOrders.find(o => o.id === currentOrder.id);
      if (currentOrder.status === 'READY' && previousOrder?.status !== 'READY') {
        // showSuccess(`Pedido #${currentOrder.pin} (Senha: ${currentOrder.password}) marcado como PRONTO!`); // REMOVIDO
      }
    });

    previousOrdersRef.current = orders;
  }, [orders]); // Dependência apenas de orders para este efeito

  const displayAlert = (title: string, message: string, variant: 'error' | 'info' | 'success' = 'error') => {
    setAlertModalMessage({ title, message, variant });
    setShowAlertModal(true);
  };

  // Pré-marcar unidades já entregues (entrega direta) ao abrir confirmação
  useEffect(() => {
    if (showDeliveryConfirmation && orderToDeliver) {
      const init: Record<string, boolean> = {};
      (orderToDeliver.items || []).forEach(it => {
        const totalUnits = Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1));
        const delivered = Math.max(0, it.directDeliveredUnitCount || 0);
        for (let i = 0; i < totalUnits; i++) {
          const key = `${it.id}-${i}`;
          init[key] = i < delivered; // Unidades já entregues ficam pré-marcadas
        }
      });
      setDeliveryUnitChecks(init);
    } else {
      setDeliveryUnitChecks({});
    }
  }, [showDeliveryConfirmation, orderToDeliver]);

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    if (status === 'DELIVERED') {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setOrderToDeliver(order);
        setShowDeliveryConfirmation(true);
      }
      return;
    }
    
    startTransition(() => {
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id === orderId) {
          const now = new Date();
          let readyAt = order.readyAt;
          let updatedAt = order.updatedAt;
          
          if (status === 'PREPARING' && order.status === 'NEW') {
            const updatedItems = order.items.map(item => ({
              ...item,
              productionUnits: item.productionUnits.map(unit => ({
                ...unit,
                unitStatus: unit.unitStatus || 'PENDING',
                completedAt: undefined, 
              }))
            }));
            updatedAt = now; 
            return { ...order, status, items: updatedItems, updatedAt, readyAt: undefined }; 
          }
          
          if (status === 'READY' && order.status === 'PREPARING') {
              readyAt = now;
              const updatedItems = order.items.map(item => ({
                  ...item,
                  productionUnits: item.productionUnits.map(unit => ({
                      ...unit,
                      unitStatus: 'READY' as ProductionUnit['unitStatus'],
                      completedAt: unit.unitStatus === 'READY' ? unit.completedAt : now, 
                  }))
              }));
              return { ...order, status, items: updatedItems, updatedAt: order.updatedAt, readyAt }; 
          }
          
          if (status === 'DELIVERED' && order.status === 'READY') {
              // Não sobrescreva updatedAt (início do preparo); registre o tempo de entrega em deliveredAt
              return { ...order, status, deliveredAt: now, updatedAt: order.updatedAt, readyAt }; 
          }
          
          if (status === 'PREPARING' && order.status === 'READY') {
              readyAt = undefined;
              return { ...order, status, updatedAt: order.updatedAt, readyAt: undefined }; 
          }
          if (status === 'NEW' && order.status === 'PREPARING') {
              return { ...order, status, updatedAt: undefined, readyAt: undefined };
          }
          
          return { ...order, status, updatedAt: now, readyAt };
        }
        return order;
      }));
    });
  };

  // NOVO: Atualizar progresso de entrega direta por item (salvar entrega parcial)
  const updateDirectDelivery = (orderId: string, updates: { itemId: string; deliveredCount: number }[]) => {
    setOrders(prevOrders => prevOrders.map(order => {
      if (order.id !== orderId) return order;
      const updatedItems = order.items.map(item => {
        const upd = updates.find(u => u.itemId === item.id);
        if (!upd) return item;
        const totalUnits = Math.max(1, item.quantity * Math.max(1, item.menuItem.unitDeliveryCount || 1));
        const delivered = Math.min(totalUnits, Math.max(0, upd.deliveredCount));
        const prevDelivered = Math.max(0, item.directDeliveredUnitCount || 0);
        const delta = delivered - prevDelivered;
        let deliveredTimes = Array.isArray(item.directDeliveredUnitTimes) ? [...item.directDeliveredUnitTimes] : [];
        const now = new Date();
        if (delta > 0) {
          // Append timestamps for newly delivered units
          for (let i = 0; i < delta; i++) {
            deliveredTimes.push(now);
          }
        } else if (delta < 0) {
          // Remove timestamps if delivery count decreased
          deliveredTimes = deliveredTimes.slice(0, Math.max(0, deliveredTimes.length + delta));
        }
        return { ...item, directDeliveredUnitCount: delivered, directDeliveredUnitTimes: deliveredTimes };
      });
      return { ...order, items: updatedItems };
    }));
  };
  
  const confirmDelivery = () => {
    if (!orderToDeliver) return;
    startTransition(() => {
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id === orderToDeliver.id) {
          // Preserve updatedAt como início do preparo; registre entrega em deliveredAt
          return { ...order, status: 'DELIVERED', deliveredAt: new Date(), updatedAt: order.updatedAt };
        }
        return order;
      }));
    });
    showSuccess(`Pedido #${orderToDeliver.pin} marcado como entregue.`);
    setShowDeliveryConfirmation(false);
    setOrderToDeliver(null);
  };

  // NOVO: confirmar entrega diretamente (sem abrir checklist/modal do Caixa)
  const confirmDeliveryImmediate = (orderId: string) => {
    startTransition(() => {
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id === orderId) {
          return { ...order, status: 'DELIVERED', deliveredAt: new Date(), updatedAt: order.updatedAt };
        }
        return order;
      }));
    });
    const ord = orders.find(o => o.id === orderId);
    showSuccess(`Pedido #${ord?.pin ?? orderId} marcado como entregue.`);
  };

  const updateProductionUnitStatus = (orderId: string, itemId: string, unitId: string, unitStatus: ProductionUnit['unitStatus'], completedObservations?: string[]) => {
    startTransition(() => {
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id === orderId) {
          const now = new Date();
          let newOrderStatus = order.status;
          let readyAt = order.readyAt;
          let orderUpdated = false;
          
          const updatedItems = order.items.map(item => {
            if (item.id === itemId) {
              const updatedUnits = item.productionUnits.map(unit => {
                  if (unit.unitId === unitId) {
                      const updatedUnit = { ...unit, unitStatus };
                      if (unitStatus === 'READY') {
                          updatedUnit.completedAt = now;
                      } else {
                          updatedUnit.completedAt = undefined;
                      }
                      if (completedObservations !== undefined) {
                          updatedUnit.completedObservations = completedObservations;
                      }
                      orderUpdated = true;
                      return updatedUnit;
                  }
                  return unit;
              });
              return { ...item, productionUnits: updatedUnits };
            }
            return item;
          });
          
          const allUnitsReady = updatedItems.every(item => 
            item.productionUnits.every(unit => unit.unitStatus === 'READY')
          );
          
          if (order.status === 'NEW' && unitStatus === 'READY') {
               newOrderStatus = 'PREPARING';
               orderUpdated = true;
          }
          
          if (order.status === 'READY' && unitStatus === 'PENDING' && !allUnitsReady) {
            newOrderStatus = 'PREPARING';
            readyAt = undefined;
            orderUpdated = true;
          }
          
          let finalUpdatedAt = order.updatedAt;
          if (newOrderStatus === 'PREPARING' && order.status === 'NEW') {
              finalUpdatedAt = now;
          }
          
          return { 
            ...order, 
            items: updatedItems, 
            status: newOrderStatus,
            updatedAt: order.status === 'NEW' && newOrderStatus === 'PREPARING' ? finalUpdatedAt : order.updatedAt, 
            readyAt: readyAt
          };
        }
        return order;
      }));
    });
  };

  const assignOperatorToUnit = (orderId: string, itemId: string, unitId: string, operatorName: string) => {
    startTransition(() => {
      setOrders(prevOrders =>
        prevOrders.map(order => {
          if (order.id === orderId) {
            return {
              ...order,
              items: order.items.map(item => {
                if (item.id === itemId) {
                  return {
                    ...item,
                    productionUnits: item.productionUnits.map(unit => 
                      unit.unitId === unitId ? { ...unit, operatorName } : unit
                    ),
                  };
                }
                return item;
              }),
            };
          }
          return order;
        })
      );
    });
  };

  const handleAssignOperatorToAll = (orderId: string, operatorName: string) => {
    startTransition(() => {
      setOrders(prevOrders =>
        prevOrders.map(order => {
          if (order.id === orderId) {
            return {
              ...order,
              items: order.items.map(item => ({
                ...item,
                productionUnits: item.productionUnits.map(unit => ({ ...unit, operatorName })),
              })),
            };
          }
          return order;
        })
      );
    });
  };

  const cancelOrder = (orderId: string, reason: string) => {
    startTransition(() => {
      setOrders(orders.map(order => 
        order.id === orderId 
          ? { ...order, status: 'CANCELLED', cancelReason: reason, updatedAt: new Date() }
          : order
      ));
    });
  };

  const { isOnline } = useOffline();
  
  const productionOrders = useMemo(() => {
    return orders.filter(order => ['NEW', 'PREPARING'].includes(order.status));
  }, [orders]);
  
  // Estilos CSS rígidos para layout one-page
  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    maxWidth: '100vw',
    overflow: 'hidden',
    boxSizing: 'border-box',
    backgroundColor: '#f9fafb',
  };

  const headerStyle: React.CSSProperties = {
    flexShrink: 0,
    padding: '4px 8px',
    overflow: 'hidden',
    maxWidth: '100%',
    boxSizing: 'border-box',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    padding: '0 4px 4px 4px',
    maxWidth: '100%',
    boxSizing: 'border-box',
  };

  return (
    <>
      <div style={pageStyle}>
        {/* Header compacto */}
        <div style={headerStyle}>
          {/* Linha 1: Título + Cozinha + Botões */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#111827', flexShrink: 0 }}>Cozinha - KDS</span>
            
            <button
              onClick={() => setShowKitchenSelectModal(true)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                padding: '2px 6px', 
                backgroundColor: '#fff7ed', 
                border: '1px solid #fed7aa', 
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                flexShrink: 0,
              }}
            >
              <i className="ri-restaurant-2-line" style={{ color: '#ea580c' }}></i>
              <span style={{ fontWeight: 500, color: '#9a3412' }}>{selectedKitchen?.name || 'Todas'}</span>
              {selectedOperator && (
                <>
                  <span style={{ color: '#d1d5db' }}>|</span>
                  <i className="ri-user-line" style={{ color: '#2563eb' }}></i>
                  <span style={{ fontWeight: 500, color: '#1e40af' }}>{selectedOperator.name}</span>
                </>
              )}
              <i className="ri-settings-3-line" style={{ color: '#9ca3af' }}></i>
            </button>

            {/* Botões de ação compactos */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginLeft: 'auto' }}>
              <button
                onClick={() => setViewMode(viewMode === 'kanban' ? 'list' : 'kanban')}
                style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: '#e5e7eb', color: '#374151' }}
              >
                {viewMode === 'kanban' ? '📋 Lista' : '📊 Kanban'}
              </button>
              <button
                onClick={() => setShowReadyModal(true)}
                style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: '#dcfce7', color: '#166534' }}
              >
                ✓ Prontos ({readyOrdersList.length})
              </button>
              <button
                onClick={() => setShowDeliveredModal(true)}
                style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: '#d1fae5', color: '#065f46' }}
              >
                ✓✓ Entregues ({deliveredOrdersList.length})
              </button>
              <button
                onClick={() => setShowCanceledModal(true)}
                style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: '#fee2e2', color: '#991b1b' }}
              >
                ✕ Cancelados ({canceledOrdersList.length})
              </button>
              <button
                onClick={() => setShowOperatorModal(true)}
                style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white' }}
              >
                + Operador
              </button>
            </div>
          </div>

          {/* Offline warning */}
          {!isOnline && (
            <div style={{ backgroundColor: '#eab308', color: 'white', textAlign: 'center', padding: '2px', fontSize: '10px', fontWeight: 500, borderRadius: '4px' }}>
              <i className="ri-wifi-off-line" style={{ marginRight: '4px' }}></i>
              Modo Offline
            </div>
          )}
        </div>

        {/* Conteúdo principal - OrderBoard ocupa todo o espaço restante */}
        <div style={contentStyle}> 
          {viewMode === 'kanban' ? (
            <OrderBoard 
              orders={orders}
              operators={operators}
              categories={categories}
              onUpdateStatus={updateOrderStatus}
              onCancelOrder={cancelOrder}
              onAssignOperator={assignOperatorToUnit}
              onAssignOperatorToAll={handleAssignOperatorToAll}
              onUpdateItemStatus={updateProductionUnitStatus}
              onUpdateDirectDelivery={updateDirectDelivery}
              onConfirmDelivery={confirmDeliveryImmediate}
            />
          ) : (
            <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
              <OrderList
                orders={productionOrders}
                operators={operators}
                categories={categories}
                onUpdateStatus={updateOrderStatus}
                onCancelOrder={cancelOrder}
                onAssignOperator={assignOperatorToUnit}
                onAssignOperatorToAll={handleAssignOperatorToAll}
                onDisplayAlert={displayAlert}
                onUpdateItemStatus={updateProductionUnitStatus}
                onUpdateDirectDelivery={updateDirectDelivery}
                onConfirmDelivery={confirmDeliveryImmediate}
              />
              <div style={{ marginTop: '8px' }}>
                <ReadyOrderTable
                  readyOrders={readyOrdersList}
                  onUpdateStatus={updateOrderStatus}
                  onUpdateDirectDelivery={updateDirectDelivery}
                  onConfirmDelivery={confirmDeliveryImmediate}
                />
              </div>
            </div>
          )}
        </div>

        <OperatorManagementModal
          isOpen={showOperatorModal}
          onClose={() => setShowOperatorModal(false)}
          operators={operators}
          setOperators={setOperators}
        />
        
        <KitchenSelectModal
          isOpen={showKitchenSelectModal}
          onClose={() => setShowKitchenSelectModal(false)}
          onSelect={(kitchen, operator) => {
            setSelectedKitchen(kitchen);
            setSelectedOperator(operator);
          }}
          currentKitchen={selectedKitchen}
          currentOperator={selectedOperator}
        />
        
        <ItemsInProductionModal
          isOpen={showItemsInProductionModal}
          onClose={() => setShowItemsInProductionModal(false)}
          orders={orders}
          operators={operators}
        />
        
        <AlertModal
          isOpen={showAlertModal}
          onClose={() => setShowAlertModal(false)}
          title={alertModalMessage.title}
          message={alertModalMessage.message}
          variant={alertModalMessage.variant}
        />
        
        {orderToDeliver && (
          <Modal
            isOpen={showDeliveryConfirmation}
            onClose={() => {
              setShowDeliveryConfirmation(false);
              setDeliveryUnitChecks({});
            }}
            title="Confirmar Entrega do Pedido"
            zIndex="z-[1000]"
            size="lg"
          >
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-green-800">
                    Pedido <span className="font-bold">#{orderToDeliver.pin}</span> • Senha <span className="font-bold">{orderToDeliver.password}</span>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <i className="ri-check-line mr-1"></i>
                    Conferência de Entrega
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {(orderToDeliver.items || []).map(it => (
                  <div key={it.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-800">
                        {it.menuItem?.name || 'Item'}
                      </div>
                      <div className="text-sm text-gray-600">Qtd: {Math.max(1, it.quantity || 1)}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {Array.from({ length: Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1)) }).map((_, idx) => {
                        const key = `${it.id}-${idx}`;
                        const checked = !!deliveryUnitChecks[key];
                        return (
                          <button
                            type="button"
                            key={key}
                            onClick={() => {
                              setDeliveryUnitChecks(prev => ({ ...prev, [key]: !prev[key] }));
                            }}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${checked ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                          >
                            <span>Unidade {idx + 1}</span>
                            <i className={checked ? 'ri-check-line' : 'ri-checkbox-blank-line'}></i>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeliveryConfirmation(false);
                    setDeliveryUnitChecks({});
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!orderToDeliver) return;
                    // Registrar entrega parcial por item
                    const updates = (orderToDeliver.items || []).map(it => {
                      const totalUnits = Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1));
                      let deliveredCount = Math.max(0, it.directDeliveredUnitCount || 0);
                      for (let i = 0; i < totalUnits; i++) {
                        const key = `${it.id}-${i}`;
                        if (deliveryUnitChecks[key]) deliveredCount++;
                      }
                      return { itemId: it.id, deliveredCount: Math.min(totalUnits, deliveredCount) };
                    });

                    // Persistir no estado dos pedidos
                    setOrders(prev => prev.map(o => {
                      if (o.id !== orderToDeliver.id) return o;
                      const newItems = o.items.map(it => {
                        const upd = updates.find(u => u.itemId === it.id);
                        if (!upd) return it;
                        return { ...it, directDeliveredUnitCount: upd.deliveredCount };
                      });
                      return { ...o, items: newItems };
                    }));

                    // Se todos completos, marcar como entregue
                    const allItemsCompleted = updates.every(u => {
                      const it = (orderToDeliver.items || []).find(i => i.id === u.itemId)!;
                      const total = Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1));
                      return u.deliveredCount >= total;
                    });
                    if (allItemsCompleted) {
                      confirmDelivery();
                    } else {
                      showSuccess('Entrega parcial registrada. Continue a entrega das unidades restantes quando necessário.');
                      setShowDeliveryConfirmation(false);
                      setOrderToDeliver(null);
                    }
                  }}
                  className="flex-1"
                  disabled={Object.values(deliveryUnitChecks).every(v => !v)}
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </Modal>
        )}
        
        <Modal
          isOpen={showReadyModal}
          onClose={() => setShowReadyModal(false)}
          title="Pedidos Prontos para Retirada"
          size="full"
        >
          <ReadyOrderTable 
            readyOrders={readyOrdersList} 
            onUpdateStatus={updateOrderStatus} 
            onUpdateDirectDelivery={updateDirectDelivery}
            onConfirmDelivery={confirmDeliveryImmediate}
          />
          <div className="flex justify-end pt-4 border-t mt-4">
            <Button variant="secondary" onClick={() => setShowReadyModal(false)}>
              Fechar
            </Button>
          </div>
        </Modal>

        <Modal
          isOpen={showDeliveredModal}
          onClose={() => setShowDeliveredModal(false)}
          title="Pedidos Entregues"
          size="lg"
        >
          <div className="space-y-4">
            {deliveredOrdersList.length === 0 ? (
              <div className="text-center py-8">
                <i className="ri-check-double-line text-4xl text-gray-400 mb-4"></i>
                <p className="text-gray-500">Nenhum pedido entregue</p>
              </div>
            ) : (
              <DeliveredOrderList deliveredOrders={deliveredOrdersList} />
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setShowDeliveredModal(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showCanceledModal}
          onClose={() => setShowCanceledModal(false)}
          title="Pedidos Cancelados"
          size="lg"
        >
          <div className="space-y-4">
            {canceledOrdersList.length === 0 ? (
              <div className="text-center py-8">
                <i className="ri-close-circle-line text-4xl text-gray-400 mb-4"></i>
                <p className="text-gray-500">Nenhum pedido cancelado</p>
              </div>
            ) : (
              <DeliveredOrderList deliveredOrders={canceledOrdersList} />
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setShowCanceledModal(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}
