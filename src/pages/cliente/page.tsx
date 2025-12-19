import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useKitchens, useKitchenSessions } from '../../hooks/useDatabase';
import { Category, MenuItem, OrderItem, Order, ProductionUnit, RequiredModifierGroup } from '../../types';
import { mockCategories, mockMenuItems } from '../../mocks/data';
import Button from '../../components/base/Button';
import Modal from '../../components/base/Modal';

// Tipos específicos do módulo cliente
interface ClienteConfig {
  isConfigured: boolean;
  kitchenId: string | null;
  storeName: string;
}

type ClienteView = 'config' | 'menu' | 'cart' | 'payment' | 'success';

// Função para gerar senha alfanumérica
const generatePassword = (format: 'numeric' | 'alphabetic' | 'alphanumeric' = 'numeric') => {
  if (format === 'alphabetic') {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  }
  if (format === 'alphanumeric') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
  return Math.floor(100 + Math.random() * 900).toString();
};

// Função para criar unidades de produção
const createProductionUnits = (quantity: number): ProductionUnit[] => {
  return Array.from({ length: quantity }, () => ({
    unitId: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    unitStatus: 'PENDING' as const,
  }));
};

export default function ClientePage() {
  const navigate = useNavigate();
  
  // Estados de configuração
  const [config, setConfig] = useState<ClienteConfig>({
    isConfigured: false,
    kitchenId: null,
    storeName: 'Loja',
  });
  
  // Estados de dados
  const [categories] = useLocalStorage<Category[]>('categories', mockCategories);
  const [menuItems] = useLocalStorage<MenuItem[]>('menuItems', mockMenuItems);
  const [orders, setOrders] = useLocalStorage<Order[]>('orders', []);
  const [globalObservations] = useLocalStorage<string[]>('globalObservations', []);
  const [appConfig] = useLocalStorage<any>('appConfig', { passwordFormat: 'numeric' });
  const [operationalSession] = useLocalStorage<any>('currentOperationalSession', null);
  const { kitchens } = useKitchens();
  const { onlineKitchenIds, openSessions } = useKitchenSessions();
  
  // Estados da interface
  const [view, setView] = useState<ClienteView>('config');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  
  // Estados do modal de item
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string>>({});
  const [selectedObservations, setSelectedObservations] = useState<string[]>([]);
  
  // Keyboard shortcut para sair (CTRL+SHIFT+L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setView('config');
        setConfig(prev => ({ ...prev, isConfigured: false }));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Determina a cozinha efetiva (configurada ou primeira online)
  const effectiveKitchenId = useMemo(() => {
    // Se configurou uma cozinha específica, usa ela
    if (config.kitchenId) return config.kitchenId;
    // Se não, usa a primeira cozinha online (se houver)
    if (onlineKitchenIds.length === 1) return onlineKitchenIds[0];
    // Se houver múltiplas ou nenhuma, não filtra
    return null;
  }, [config.kitchenId, onlineKitchenIds]);

  // Categorias ativas (filtradas por cozinha se aplicável)
  const activeCategories = useMemo(() => {
    let cats = categories.filter(c => c.active).sort((a, b) => a.order - b.order);
    
    // Se tem cozinha efetiva, filtra categorias dessa cozinha
    if (effectiveKitchenId) {
      cats = cats.filter(cat => {
        // Se a categoria não tem kitchenIds, pertence a todas
        if (!cat.kitchenIds || cat.kitchenIds.length === 0) return true;
        return cat.kitchenIds.includes(effectiveKitchenId);
      });
    }
    
    return cats;
  }, [categories, effectiveKitchenId]);
  
  // Itens filtrados por categoria e cozinha
  const filteredItems = useMemo(() => {
    let items = menuItems.filter(item => item.active);
    
    // Filtra por categoria selecionada
    if (selectedCategory) {
      items = items.filter(item => item.categoryId === selectedCategory);
    }
    
    // Filtra por cozinha efetiva
    if (effectiveKitchenId) {
      items = items.filter(item => {
        // Itens que pulam cozinha aparecem sempre
        if (item.skipKitchen) return true;
        // Verifica se a categoria do item pertence à cozinha
        const itemCategory = categories.find(c => c.id === item.categoryId);
        if (!itemCategory?.kitchenIds || itemCategory.kitchenIds.length === 0) return true;
        return itemCategory.kitchenIds.includes(effectiveKitchenId);
      });
    }
    
    return items;
  }, [menuItems, selectedCategory, effectiveKitchenId, categories]);
  
  // Total do carrinho
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }, [cartItems]);
  
  // Handlers
  const handleStartSession = () => {
    if (!config.storeName.trim()) return;
    setConfig(prev => ({ ...prev, isConfigured: true }));
    setView('menu');
  };
  
  const handleSelectItem = (item: MenuItem) => {
    setSelectedItem(item);
    setItemQuantity(1);
    setSelectedModifiers({});
    setSelectedObservations([]);
    setShowItemModal(true);
  };
  
  const handleAddToCart = () => {
    if (!selectedItem) return;
    
    // Verifica modificadores obrigatórios
    const activeModifierGroups = (selectedItem.requiredModifierGroups || []).filter(g => g.active);
    for (const group of activeModifierGroups) {
      if (!selectedModifiers[group.id]) {
        alert(`Selecione uma opção de "${group.name}"`);
        return;
      }
    }
    
    // Monta observações
    const observations: string[] = [];
    for (const [groupId, option] of Object.entries(selectedModifiers)) {
      const group = activeModifierGroups.find(g => g.id === groupId);
      if (group) observations.push(`${group.name}: ${option}`);
    }
    observations.push(...selectedObservations);
    
    const orderItem: OrderItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      menuItem: selectedItem,
      quantity: itemQuantity,
      unitPrice: selectedItem.price,
      observations: observations.join(', ') || undefined,
      productionUnits: selectedItem.skipKitchen ? [] : createProductionUnits(itemQuantity),
      skipKitchen: selectedItem.skipKitchen,
      allowPartialDelivery: true,
    };
    
    setCartItems(prev => [...prev, orderItem]);
    setShowItemModal(false);
    setSelectedItem(null);
  };
  
  const handleRemoveFromCart = (itemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };
  
  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return {
        ...item,
        quantity: newQty,
        productionUnits: item.skipKitchen ? [] : createProductionUnits(newQty),
      };
    }));
  };
  
  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    setView('payment');
  };
  
  const handleConfirmOrder = (paymentMethod: string) => {
    const password = generatePassword(appConfig.passwordFormat);
    const pin = `C${Date.now().toString().slice(-6)}`;
    
    const newOrder: Order = {
      id: Date.now().toString(),
      pin,
      password,
      items: cartItems,
      total: cartTotal,
      paymentMethod,
      status: 'NEW',
      createdAt: new Date(),
      slaMinutes: Math.max(...cartItems.map(i => i.menuItem.sla)),
      createdBy: 'TOTEM',
      operationalSessionId: operationalSession?.id,
    };
    
    setOrders(prev => [...prev, newOrder]);
    setCurrentOrder(newOrder);
    setCartItems([]);
    setView('success');
  };
  
  const handleNewOrder = () => {
    setCurrentOrder(null);
    setSelectedCategory('');
    setView('menu');
  };
  
  // ====== TELA DE CONFIGURAÇÃO ======
  if (view === 'config') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-user-smile-fill text-white text-4xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Totem de Autoatendimento</h1>
            <p className="text-gray-500 mt-2">Configure o terminal para iniciar</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Loja/Terminal
              </label>
              <input
                type="text"
                value={config.storeName}
                onChange={(e) => setConfig(prev => ({ ...prev, storeName: e.target.value }))}
                placeholder="Ex: Loja Centro, Terminal 1..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
            
            {/* Seleção de Cozinha com Status Online */}
            {kitchens.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cozinha
                </label>
                {onlineKitchenIds.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={config.kitchenId || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, kitchenId: e.target.value || null }))}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent ${
                        config.kitchenId && onlineKitchenIds.includes(config.kitchenId)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <option value="">
                        {onlineKitchenIds.length === 1 
                          ? `Automático (${kitchens.find(k => k.id === onlineKitchenIds[0])?.name || 'Online'})`
                          : 'Selecione uma cozinha'}
                      </option>
                      {kitchens.filter(k => k.isActive).map(k => (
                        <option key={k.id} value={k.id}>
                          {onlineKitchenIds.includes(k.id) ? '🟢' : '⚪'} {k.name}
                        </option>
                      ))}
                    </select>
                    {/* Status de cozinhas online */}
                    <div className="flex flex-wrap gap-2">
                      {openSessions.map(session => (
                        <span 
                          key={session.id}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                        >
                          <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                          {session.kitchenName}
                          {session.operatorName && ` • ${session.operatorName}`}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center text-amber-800">
                      <i className="ri-alert-line text-xl mr-2"></i>
                      <div>
                        <p className="font-medium">Nenhuma cozinha online</p>
                        <p className="text-sm text-amber-600">Abra uma cozinha no KDS para filtrar automaticamente os itens.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <Button
              onClick={handleStartSession}
              className="w-full py-4 text-lg bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
              disabled={!config.storeName.trim()}
            >
              <i className="ri-play-fill mr-2"></i>
              Iniciar Atendimento
            </Button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full text-center text-gray-500 hover:text-gray-700 text-sm"
            >
              <i className="ri-arrow-left-line mr-1"></i>
              Voltar ao Sistema
            </button>
          </div>
          
          <p className="text-center text-xs text-gray-400 mt-6">
            Pressione <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Ctrl</kbd> + 
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 ml-1">Shift</kbd> + 
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 ml-1">L</kbd> para sair do modo cliente
          </p>
        </div>
      </div>
    );
  }
  
  // ====== TELA DE SUCESSO ======
  if (view === 'success' && currentOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 max-w-lg w-full text-center">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-check-line text-emerald-600 text-5xl"></i>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pedido Confirmado!</h1>
          <p className="text-gray-500 mb-8">Aguarde sua senha ser chamada</p>
          
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-8 mb-8">
            <p className="text-white/80 text-sm uppercase tracking-wide mb-2">Sua Senha</p>
            <p className="text-6xl font-black text-white tracking-widest">{currentOrder.password}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Pedido</p>
              <p className="text-lg font-bold text-gray-900">#{currentOrder.pin}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Total</p>
              <p className="text-lg font-bold text-emerald-600">R$ {currentOrder.total.toFixed(2)}</p>
            </div>
          </div>
          
          <Button
            onClick={handleNewOrder}
            className="w-full py-4 text-lg"
          >
            <i className="ri-add-line mr-2"></i>
            Fazer Novo Pedido
          </Button>
        </div>
      </div>
    );
  }
  
  // ====== TELA DE PAGAMENTO ======
  if (view === 'payment') {
    const paymentMethods = ['PIX', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito'];
    
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 p-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setView('cart')}
              className="p-2 rounded-xl hover:bg-gray-100"
            >
              <i className="ri-arrow-left-line text-2xl text-gray-600"></i>
            </button>
            <h1 className="text-xl font-bold text-gray-900">Pagamento</h1>
            <div className="w-10"></div>
          </div>
        </header>
        
        {/* Content */}
        <main className="flex-1 p-4">
          <div className="max-w-2xl mx-auto">
            {/* Resumo */}
            <div className="bg-white rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumo do Pedido</h2>
              <div className="space-y-2 mb-4">
                {cartItems.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.quantity}x {item.menuItem.name}</span>
                    <span className="font-medium">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span className="text-emerald-600">R$ {cartTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            {/* Formas de Pagamento */}
            <div className="bg-white rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Forma de Pagamento</h2>
              <div className="grid grid-cols-2 gap-4">
                {paymentMethods.map(method => (
                  <button
                    key={method}
                    onClick={() => handleConfirmOrder(method)}
                    className="p-6 rounded-2xl border-2 border-gray-200 hover:border-rose-500 hover:bg-rose-50 transition-all text-center group"
                  >
                    <i className={`text-4xl mb-2 block ${
                      method === 'PIX' ? 'ri-qr-code-line text-emerald-500' :
                      method === 'Dinheiro' ? 'ri-money-dollar-circle-line text-green-500' :
                      'ri-bank-card-line text-blue-500'
                    }`}></i>
                    <span className="font-semibold text-gray-900 group-hover:text-rose-600">{method}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  // ====== TELA DO CARRINHO ======
  if (view === 'cart') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 p-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setView('menu')}
              className="p-2 rounded-xl hover:bg-gray-100"
            >
              <i className="ri-arrow-left-line text-2xl text-gray-600"></i>
            </button>
            <h1 className="text-xl font-bold text-gray-900">Seu Pedido</h1>
            <div className="w-10"></div>
          </div>
        </header>
        
        {/* Content */}
        <main className="flex-1 p-4 pb-32">
          <div className="max-w-2xl mx-auto">
            {cartItems.length === 0 ? (
              <div className="text-center py-12">
                <i className="ri-shopping-bag-line text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">Seu carrinho está vazio</p>
                <Button
                  onClick={() => setView('menu')}
                  variant="secondary"
                  className="mt-4"
                >
                  Ver Cardápio
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {cartItems.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.menuItem.name}</h3>
                        {item.observations && (
                          <p className="text-sm text-gray-500 mt-1">{item.observations}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <i className="ri-delete-bin-line text-xl"></i>
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <i className="ri-subtract-line"></i>
                        </button>
                        <span className="text-lg font-semibold w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <i className="ri-add-line"></i>
                        </button>
                      </div>
                      <span className="text-lg font-bold text-emerald-600">
                        R$ {(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
        
        {/* Footer */}
        {cartItems.length > 0 && (
          <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg text-gray-600">Total</span>
                <span className="text-2xl font-bold text-emerald-600">R$ {cartTotal.toFixed(2)}</span>
              </div>
              <Button
                onClick={handleCheckout}
                className="w-full py-4 text-lg bg-gradient-to-r from-rose-500 to-pink-500"
              >
                Continuar para Pagamento
              </Button>
            </div>
          </footer>
        )}
      </div>
    );
  }
  
  // ====== TELA DO MENU (PRINCIPAL) ======
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="p-4 lg:p-6 xl:p-8 max-w-[2000px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900">{config.storeName}</h1>
              <p className="text-sm lg:text-base text-gray-500">Faça seu pedido</p>
            </div>
            <button
              onClick={() => setView('cart')}
              className="relative p-3 lg:p-4 bg-gradient-to-r from-rose-500 to-pink-500 rounded-xl text-white"
            >
              <i className="ri-shopping-bag-3-line text-2xl lg:text-3xl"></i>
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-1 w-6 h-6 lg:w-7 lg:h-7 bg-amber-500 rounded-full text-xs lg:text-sm font-bold flex items-center justify-center">
                  {cartItems.length}
                </span>
              )}
            </button>
          </div>
          
          {/* Categorias */}
          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all ${
                !selectedCategory
                  ? 'bg-rose-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            {activeCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <i className={`${cat.icon} mr-2`}></i>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </header>
      
      {/* Menu Grid */}
      <main className="flex-1 p-4 pb-32 lg:p-6 xl:p-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 lg:gap-6">
          {filteredItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleSelectItem(item)}
              className="bg-white rounded-2xl p-4 text-left hover:shadow-lg transition-all group"
            >
              {item.image ? (
                <div className="aspect-square rounded-xl bg-gray-100 mb-3 overflow-hidden">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                  />
                </div>
              ) : (
                <div className="aspect-square rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 mb-3 flex items-center justify-center">
                  <i className="ri-restaurant-line text-4xl text-gray-400"></i>
                </div>
              )}
              <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">{item.name}</h3>
              <p className="text-lg font-bold text-emerald-600">R$ {item.price.toFixed(2)}</p>
            </button>
          ))}
        </div>
        
        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <i className="ri-restaurant-line text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-500">Nenhum item encontrado</p>
          </div>
        )}
      </main>
      
      {/* Footer com Carrinho */}
      {cartItems.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <button
            onClick={() => setView('cart')}
            className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold">
                {cartItems.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
              <span className="font-semibold">Ver Carrinho</span>
            </div>
            <span className="text-xl font-bold">R$ {cartTotal.toFixed(2)}</span>
          </button>
        </footer>
      )}
      
      {/* Modal de Item */}
      <Modal
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        title={selectedItem?.name || ''}
        size="lg"
      >
        {selectedItem && (
          <div className="space-y-6">
            {/* Preço */}
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-emerald-600">
                R$ {selectedItem.price.toFixed(2)}
              </span>
              <span className="text-sm text-gray-500">
                <i className="ri-time-line mr-1"></i>
                ~{selectedItem.sla} min
              </span>
            </div>
            
            {/* Modificadores Obrigatórios */}
            {selectedItem.requiredModifierGroups?.filter(g => g.active).map(group => (
              <div key={group.id} className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900">
                  {group.name} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {group.options.map(option => (
                    <button
                      key={option}
                      onClick={() => setSelectedModifiers(prev => ({ ...prev, [group.id]: option }))}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        selectedModifiers[group.id] === option
                          ? 'border-rose-500 bg-rose-50 text-rose-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            
            {/* Observações Opcionais */}
            {(selectedItem.observations?.length > 0 || globalObservations.length > 0) && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900">
                  Observações (opcional)
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {[...(selectedItem.observations || []), ...globalObservations].map(obs => (
                    <button
                      key={obs}
                      onClick={() => {
                        setSelectedObservations(prev => 
                          prev.includes(obs) 
                            ? prev.filter(o => o !== obs)
                            : [...prev, obs]
                        );
                      }}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        selectedObservations.includes(obs)
                          ? 'bg-rose-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {obs}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Quantidade */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Quantidade</span>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setItemQuantity(prev => Math.max(1, prev - 1))}
                  className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl"
                >
                  <i className="ri-subtract-line"></i>
                </button>
                <span className="text-2xl font-bold w-12 text-center">{itemQuantity}</span>
                <button
                  onClick={() => setItemQuantity(prev => prev + 1)}
                  className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl"
                >
                  <i className="ri-add-line"></i>
                </button>
              </div>
            </div>
            
            {/* Botão Adicionar */}
            <Button
              onClick={handleAddToCart}
              className="w-full py-4 text-lg bg-gradient-to-r from-rose-500 to-pink-500"
            >
              Adicionar R$ {(selectedItem.price * itemQuantity).toFixed(2)}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

