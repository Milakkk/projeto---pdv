import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
  category_name?: string;
  image_url?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Kitchen {
  id: string;
  name: string;
}

interface ClienteConfig {
  kitchenId: string | null;
  kitchenName: string;
  operatorName: string;
}

export default function ClientePdvPage() {
  const navigate = useNavigate();
  const [showConfig, setShowConfig] = useState(true);
  const [config, setConfig] = useState<ClienteConfig>({
    kitchenId: null,
    kitchenName: 'Todas',
    operatorName: '',
  });
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; kitchen_id?: string }[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderPin, setOrderPin] = useState('');

  // Função para carregar dados do banco
  const loadData = useCallback(async () => {
    const api = (window as any)?.api;
    if (!api?.db?.query) return;

    try {
      // Carregar cozinhas
      const kitchensRes = await api.db.query('SELECT * FROM kitchens WHERE is_active = 1 ORDER BY name');
      if (kitchensRes?.rows) {
        setKitchens(kitchensRes.rows);
      }

      // Carregar categorias
      const categoriesRes = await api.db.query('SELECT * FROM categories ORDER BY name');
      if (categoriesRes?.rows) {
        setCategories(categoriesRes.rows);
      }

      // Carregar produtos
      const productsRes = await api.db.query(`
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON c.id = p.category_id 
        WHERE p.is_active = 1 
        ORDER BY p.name
      `);
      if (productsRes?.rows) {
        setProducts(productsRes.rows.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: (p.price_cents || 0) / 100,
          category_id: p.category_id,
          category_name: p.category_name,
        })));
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }, []);

  // Carregar dados inicialmente
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Escutar mudanças no banco de dados
  useEffect(() => {
    const api = (window as any)?.api;
    if (!api?.db?.onChange) return;

    const unsub = api.db.onChange((payload: any) => {
      const table = String(payload?.table || '').toLowerCase();
      if (['products', 'categories', 'kitchens'].includes(table)) {
        loadData();
      }
    });

    return () => unsub?.();
  }, [loadData]);

  // Atalho Ctrl+Shift+L para voltar às configurações
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setShowConfig(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtrar produtos por categoria e cozinha
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filtrar por cozinha (através das categorias)
    if (config.kitchenId) {
      const kitchenCategoryIds = categories
        .filter(c => c.kitchen_id === config.kitchenId)
        .map(c => c.id);
      filtered = filtered.filter(p => kitchenCategoryIds.includes(p.category_id));
    }

    // Filtrar por categoria selecionada
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    // Filtrar por busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.category_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [products, categories, config.kitchenId, selectedCategory, searchQuery]);

  // Filtrar categorias por cozinha
  const filteredCategories = useMemo(() => {
    if (!config.kitchenId) return categories;
    return categories.filter(c => c.kitchen_id === config.kitchenId || !c.kitchen_id);
  }, [categories, config.kitchenId]);

  // Funções do carrinho
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const newQty = Math.max(0, item.quantity + delta);
          return newQty === 0 ? null : { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[]
    );
  }, []);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Finalizar pedido
  const handleCheckout = async () => {
    const api = (window as any)?.api;
    if (!api?.db?.query) return;

    try {
      const orderId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const now = new Date().toISOString();
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      const password = Math.random().toString(36).slice(2, 6).toUpperCase();
      const totalCents = Math.round(cartTotal * 100);

      // Criar pedido
      await api.db.query(
        `INSERT INTO orders (id, status, total_cents, opened_at, notes, updated_at, version, pending_sync) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, 'open', totalCents, now, `CLIENTE PDV - ${config.operatorName || 'Auto'}`, now, 1, 1]
      );

      // Adicionar itens
      for (const item of cart) {
        const itemId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await api.db.query(
          `INSERT INTO order_items (id, order_id, product_id, qty, unit_price_cents, updated_at, version, pending_sync)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, orderId, item.product.id, item.quantity, Math.round(item.product.price * 100), now, 1, 1]
        );
      }

      // Salvar detalhes do pedido
      await api.db.query(
        `INSERT INTO orders_details (order_id, pin, password, updated_at) VALUES (?, ?, ?, ?)`,
        [orderId, pin, password, now]
      );

      // Criar ticket KDS
      const ticketId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await api.db.query(
        `INSERT INTO kds_tickets (id, order_id, status, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?)`,
        [ticketId, orderId, 'queued', now, 1, 1]
      );

      // Registrar tempo inicial
      await api.db.query(
        `INSERT INTO kds_phase_times (order_id, new_start, updated_at) VALUES (?, ?, ?)`,
        [orderId, now, now]
      );

      setOrderPin(pin);
      setOrderComplete(true);
      setCart([]);
      setShowCheckout(false);

      // Voltar para tela inicial após 5 segundos
      setTimeout(() => {
        setOrderComplete(false);
        setOrderPin('');
      }, 8000);

    } catch (err) {
      console.error('Erro ao criar pedido:', err);
    }
  };

  // Tela de configuração inicial
  if (showConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
              <i className="ri-user-heart-fill text-4xl text-white"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">PDV Cliente</h1>
            <p className="text-gray-500 mt-1">Configure antes de iniciar</p>
          </div>

          <div className="space-y-6">
            {/* Seleção de Cozinha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cozinha (Filtro de Produtos)
              </label>
              <select
                value={config.kitchenId || ''}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  kitchenId: e.target.value || null,
                  kitchenName: e.target.value 
                    ? kitchens.find(k => k.id === e.target.value)?.name || 'Selecionada'
                    : 'Todas'
                }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-lg"
              >
                <option value="">Todas as Cozinhas</option>
                {kitchens.map(k => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>

            {/* Nome do Operador (opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Operador (opcional)
              </label>
              <input
                type="text"
                value={config.operatorName}
                onChange={(e) => setConfig(prev => ({ ...prev, operatorName: e.target.value }))}
                placeholder="Ex: Terminal 1"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-lg"
              />
            </div>

            {/* Botão Iniciar */}
            <button
              onClick={() => setShowConfig(false)}
              className="w-full py-4 px-6 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-xl font-bold rounded-xl hover:from-rose-600 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
            >
              <i className="ri-play-fill mr-2"></i>
              Iniciar Terminal
            </button>

            {/* Voltar */}
            <button
              onClick={() => navigate('/module-selector')}
              className="w-full py-3 px-6 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <i className="ri-arrow-left-line mr-2"></i>
              Voltar ao Menu
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Pressione <kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl+Shift+L</kbd> para voltar a esta tela
          </p>
        </div>
      </div>
    );
  }

  // Tela de pedido completo
  if (orderComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
            <i className="ri-check-line text-7xl"></i>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4">Pedido Enviado!</h1>
          <p className="text-xl sm:text-2xl mb-8 opacity-90">Seu pedido foi recebido com sucesso</p>
          
          <div className="bg-white/20 backdrop-blur-sm rounded-3xl p-8 max-w-sm mx-auto">
            <p className="text-lg mb-2">Sua senha é:</p>
            <p className="text-6xl sm:text-7xl font-black tracking-wider">{orderPin}</p>
            <p className="text-sm mt-4 opacity-75">Aguarde ser chamado</p>
          </div>

          <p className="mt-8 text-sm opacity-60">Voltando ao menu em alguns segundos...</p>
        </div>
      </div>
    );
  }

  // Tela principal do cliente
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
            <i className="ri-store-3-fill text-white text-xl"></i>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Faça seu Pedido</h1>
            <p className="text-xs text-gray-500">{config.kitchenName}</p>
          </div>
        </div>

        {/* Busca */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
        </div>

        {/* Carrinho */}
        <button
          onClick={() => setShowCart(true)}
          className="relative flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-full font-medium hover:from-rose-600 hover:to-pink-700 transition-all"
        >
          <i className="ri-shopping-cart-2-fill text-xl"></i>
          <span className="hidden sm:inline">Carrinho</span>
          {cartItemCount > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full text-xs font-bold flex items-center justify-center">
              {cartItemCount}
            </span>
          )}
        </button>
      </header>

      {/* Categorias */}
      <div className="bg-white border-b px-4 py-3 overflow-x-auto">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition-all ${
              !selectedCategory
                ? 'bg-rose-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {filteredCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-rose-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Produtos */}
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredProducts.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all p-4 text-left group"
            >
              {/* Imagem placeholder */}
              <div className="aspect-square rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 mb-3 flex items-center justify-center group-hover:from-rose-50 group-hover:to-pink-50 transition-colors">
                <i className="ri-restaurant-fill text-4xl text-gray-400 group-hover:text-rose-400 transition-colors"></i>
              </div>
              
              <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">
                {product.name}
              </h3>
              <p className="text-xs text-gray-500 mb-2">{product.category_name}</p>
              <p className="text-lg font-bold text-rose-600">
                R$ {product.price.toFixed(2)}
              </p>

              <div className="mt-2 py-2 px-3 bg-rose-500 text-white text-xs font-medium rounded-lg text-center opacity-0 group-hover:opacity-100 transition-opacity">
                + Adicionar
              </div>
            </button>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <i className="ri-search-eye-line text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-500">Nenhum produto encontrado</p>
          </div>
        )}
      </main>

      {/* Barra inferior com total */}
      {cart.length > 0 && !showCart && (
        <div className="bg-white border-t px-4 py-3 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-sm text-gray-500">{cartItemCount} itens</p>
            <p className="text-xl font-bold text-gray-900">R$ {cartTotal.toFixed(2)}</p>
          </div>
          <button
            onClick={() => setShowCart(true)}
            className="px-8 py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold rounded-xl hover:from-rose-600 hover:to-pink-700 transition-all"
          >
            Ver Carrinho
          </button>
        </div>
      )}

      {/* Modal do Carrinho */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold">Seu Carrinho</h2>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            {/* Itens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <i className="ri-shopping-cart-2-line text-5xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500">Carrinho vazio</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <i className="ri-restaurant-fill text-2xl text-gray-400"></i>
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 text-sm">{item.product.name}</h3>
                      <p className="text-rose-600 font-bold">R$ {item.product.price.toFixed(2)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                      >
                        <i className="ri-subtract-line"></i>
                      </button>
                      <span className="w-8 text-center font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-8 h-8 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center"
                      >
                        <i className="ri-add-line"></i>
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="border-t p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total</span>
                  <span className="text-2xl font-bold text-gray-900">R$ {cartTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-lg font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all"
                >
                  <i className="ri-check-line mr-2"></i>
                  Finalizar Pedido
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

