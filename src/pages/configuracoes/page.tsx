import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { MenuItem, Category, RequiredModifierGroup } from '../../types';
import Button from '../../components/base/Button';
import Modal from '../../components/base/Modal';
import Input from '../../components/base/Input';
import ConfirmationModal from '../../components/base/ConfirmationModal';
import { mockCategories, mockMenuItems, mockPaymentMethods } from '../../mocks/data';
import { DEFAULT_PAYMENT_SHORTCUTS } from '../../utils/constants';
import { listCategories as dbListCategories, listProducts as dbListProducts, upsertCategory, deleteCategory as dbDeleteCategory, upsertProduct, deleteProduct as dbDeleteProduct } from '../../offline/services/productsService';

type ConfigTab = 'categories' | 'items' | 'payments' | 'general' | 'shortcuts';
type PasswordFormat = 'numeric' | 'alphabetic' | 'alphanumeric';

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<ConfigTab>('categories');
  const [categories, setCategories] = useLocalStorage<Category[]>('categories', mockCategories);
  const [menuItems, setMenuItems] = useLocalStorage<MenuItem[]>('menuItems', mockMenuItems);
  const [paymentMethods, setPaymentMethods] = useLocalStorage<string[]>('paymentMethods', mockPaymentMethods);
  const [globalObservations, setGlobalObservations] = useLocalStorage<string[]>('globalObservations', [
    'Sem cebola',
    'Sem tomate',
    'Sem maionese',
    'Bem passado',
    'Mal passado',
    'Extra queijo',
    'Sem pimenta'
  ]);
  const [appConfig, setAppConfig] = useLocalStorage<any>('appConfig', { 
    checkoutShortcut: 'F', // Atalho padrão
    soundAlert: true,
    darkMode: false,
    defaultSla: 15,
    establishmentName: 'Meu Trailer',
    passwordFormat: 'numeric' as PasswordFormat // Novo campo
  });
  const [paymentShortcuts, setPaymentShortcuts] = useLocalStorage<Record<string, string>>('paymentShortcuts', DEFAULT_PAYMENT_SHORTCUTS);

  // NOVOS ESTADOS PARA IMAGEM
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Estados para seleção múltipla
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);

  // Carregar categorias e itens do SQLite ao montar (fallback para LocalStorage/mocks)
  useEffect(() => {
    (async () => {
      try {
        const [catRows, prodRows] = await Promise.all([dbListCategories(), dbListProducts()]);
        const mappedCats: Category[] = (catRows || []).map((c: any, idx: number) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
          icon: 'ri-restaurant-line',
          order: idx + 1,
          active: true,
          integrationCode: ''
        }));
        if (mappedCats.length) setCategories(mappedCats);

        const mappedItems: MenuItem[] = (prodRows || []).map((p: any, idx: number) => ({
          id: String(p.id),
          name: String(p.name ?? ''),
          price: Number((p.priceCents ?? 0) / 100),
          sla: appConfig?.defaultSla ?? 15,
          categoryId: p.categoryId ? String(p.categoryId) : '',
          observations: [],
          requiredModifierGroups: [],
          image: undefined,
          active: !!p.isActive,
          code: String(idx + 1),
          integrationCode: undefined,
          skipKitchen: false,
          allowPartialDelivery: true,
          unitDeliveryCount: 1,
        }));
        if (mappedItems.length) setMenuItems(mappedItems);
      } catch (err) {
        console.warn('Falha ao carregar catálogo do SQLite; mantendo LocalStorage/mocks.', err);
      }
    })();
  }, []);

  // Busca de itens do cardápio
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  // Busca de categorias
  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  // Estados para arrastar e soltar itens (DnD)
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);
  // Estados para arrastar e soltar categorias (DnD)
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);

  // Refs e controle de auto-scroll durante DnD
  const dragClientYRef = useRef<number | null>(null);
  const autoScrollIntervalRef = useRef<number | null>(null);
  const itemsContainerRef = useRef<HTMLDivElement | null>(null);
  const categoriesContainerRef = useRef<HTMLDivElement | null>(null);
  const windowDragOverHandlerRef = useRef<((e: DragEvent) => void) | null>(null);

  const startAutoScroll = () => {
    if (autoScrollIntervalRef.current !== null) return;
    autoScrollIntervalRef.current = window.setInterval(() => {
      const y = dragClientYRef.current;
      if (y == null) return;
      const threshold = 80; // px
      const speed = 28; // px por tick
      
      // Primeiro tenta rolar o contêiner da aba ativa
      const container = activeTab === 'items' ? itemsContainerRef.current
                        : activeTab === 'categories' ? categoriesContainerRef.current
                        : null;
      if (container && container.scrollHeight > container.clientHeight) {
        const rect = container.getBoundingClientRect();
        if (y < rect.top + threshold) {
          container.scrollTop = Math.max(0, container.scrollTop - speed);
        } else if (y > rect.bottom - threshold) {
          container.scrollTop = Math.min(container.scrollHeight, container.scrollTop + speed);
        }
        return;
      }

      // Se o contêiner de itens não for rolável, tenta o contêiner de conteúdo principal
      const pageContainer = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement | null;
      if (pageContainer && pageContainer.scrollHeight > pageContainer.clientHeight) {
        const rect = pageContainer.getBoundingClientRect();
        if (y < rect.top + threshold) {
          pageContainer.scrollTop = Math.max(0, pageContainer.scrollTop - speed);
        } else if (y > rect.bottom - threshold) {
          pageContainer.scrollTop = Math.min(pageContainer.scrollHeight, pageContainer.scrollTop + speed);
        }
        return;
      }

      // Por fim, rola a janela
      const vh = window.innerHeight;
      if (y < threshold) {
        window.scrollBy({ top: -speed, behavior: 'auto' });
      } else if (y > vh - threshold) {
        window.scrollBy({ top: speed, behavior: 'auto' });
      }
    }, 16);
  };

  const stopAutoScroll = () => {
    if (autoScrollIntervalRef.current !== null) {
      window.clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    dragClientYRef.current = null;
  };

  const handleDragOverViewport = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragClientYRef.current = e.clientY;
  };

  const attachGlobalDragOver = () => {
    if (windowDragOverHandlerRef.current) return;
    const handler = (e: DragEvent) => {
      dragClientYRef.current = e.clientY;
    };
    windowDragOverHandlerRef.current = handler;
    window.addEventListener('dragover', handler);
  };

  const detachGlobalDragOver = () => {
    const handler = windowDragOverHandlerRef.current;
    if (handler) {
      window.removeEventListener('dragover', handler);
      windowDragOverHandlerRef.current = null;
    }
  };

  // Estados para modais
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false); // Novo estado para confirmação
  const [confirmationData, setConfirmationData] = useState<{
    title: string;
    message: string | React.ReactNode;
    onConfirm: () => void;
    variant: 'danger' | 'warning' | 'info';
    confirmText?: string;
  } | null>(null);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingPayment, setEditingPayment] = useState<string>('');

  // Estados para formulários
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: 'ri-restaurant-line', integrationCode: '' });
  const [iconSearchTerm, setIconSearchTerm] = useState('');
  const [itemForm, setItemForm] = useState({
    name: '',
    price: '',
    sla: '',
    categoryId: '',
    observations: [] as string[],
    requiredModifierGroups: [] as RequiredModifierGroup[], // NOVO CAMPO
    image: '',
    code: '',
    integrationCode: '',
    skipKitchen: false,
    allowPartialDelivery: false,
    unitDeliveryCount: '' as unknown as number | string
  });
  const [paymentForm, setPaymentForm] = useState('');
  const [newObservation, setNewObservation] = useState('');
  
  // Estados para Modificadores Obrigatórios
  const [newModifierGroupName, setNewModifierGroupName] = useState('');
  const [newModifierOption, setNewModifierOption] = useState('');
  const [currentModifierOptions, setCurrentModifierOptions] = useState<string[]>([]);
  const [newModifierGroupActive, setNewModifierGroupActive] = useState(true); // NOVO: Estado de ativo/inativo
  const [editingModifierGroupId, setEditingModifierGroupId] = useState<string | null>(null); // NOVO ESTADO


  const resetForms = () => {
    setCategoryForm({ name: '', icon: 'ri-restaurant-line', integrationCode: '' });
    setItemForm({ name: '', price: '', sla: '', categoryId: '', observations: [], requiredModifierGroups: [], image: '', code: '', integrationCode: '', skipKitchen: false, allowPartialDelivery: true, unitDeliveryCount: '' });
    setPaymentForm('');
    setNewObservation('');
    
    // Resetar estados de modificadores
    setNewModifierGroupName('');
    setNewModifierOption('');
    setCurrentModifierOptions([]);
    setNewModifierGroupActive(true); // Resetar para ativo
    setEditingModifierGroupId(null); // Resetar ID de edição
    
    setImageFile(null);
    setImagePreview('');
  };

  const resetSelections = () => {
    setSelectedCategories([]);
    setSelectedItems([]);
    setSelectedPayments([]);
  };

  // Funções de ativação/desativação
  const toggleCategoryActive = (id: string) => {
    setCategories(categories.map(cat => 
      cat.id === id ? { ...cat, active: !cat.active } : cat
    ));
  };

  const toggleItemActive = (id: string) => {
    const updated = menuItems.map(item => 
      item.id === id ? { ...item, active: !item.active } : item
    );
    setMenuItems(updated);
    const target = updated.find(i => i.id === id);
    if (target) {
      upsertProduct({ id: target.id, name: target.name, categoryId: target.categoryId || null, priceCents: Math.max(0, Math.round((target.price || 0) * 100)), isActive: target.active, sku: target.code || null });
    }
  };
  
  const toggleModifierGroupActive = (groupId: string) => {
    setItemForm(prev => ({
      ...prev,
      requiredModifierGroups: prev.requiredModifierGroups.map(group => 
        group.id === groupId ? { ...group, active: !group.active } : group
      )
    }));
  };

  // Funções de seleção múltipla
  const toggleCategorySelection = (id: string) => {
    setSelectedCategories(prev => 
      prev.includes(id) 
        ? prev.filter(catId => catId !== id)
        : [...prev, id]
    );
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  const togglePaymentSelection = (method: string) => {
    setSelectedPayments(prev => 
      prev.includes(method) 
        ? prev.filter(payment => payment !== method)
        : [...prev, method]
    );
  };

  const selectAllCategories = () => {
    if (selectedCategories.length === categories.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(categories.map(cat => cat.id));
    }
  };

  const selectAllItems = () => {
    if (selectedItems.length === menuItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(menuItems.map(item => item.id));
    }
  };

  const selectAllPayments = () => {
    if (selectedPayments.length === paymentMethods.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments([...paymentMethods]);
    }
  };

  // Lista filtrada de itens conforme termo de busca
  const filteredMenuItems = useMemo(() => {
    const term = itemSearchTerm.trim().toLowerCase();
    const base = !term
      ? menuItems
      : menuItems.filter((item) => {
        const category = categories.find((c) => c.id === item.categoryId);
        const haystack = [item.name, item.code, category?.name]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
        return haystack.some((v) => v.includes(term));
      });
    // Ordena por código numérico ascendendente para refletir a posição na lista
    return [...base].sort((a, b) => {
      const ca = parseInt((a.code || '0').toString(), 10) || 0;
      const cb = parseInt((b.code || '0').toString(), 10) || 0;
      return ca - cb;
    });
  }, [itemSearchTerm, menuItems, categories]);

  // Lista filtrada de categorias conforme termo de busca
  const filteredCategories = useMemo(() => {
    const term = categorySearchTerm.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((cat) => {
      const haystack = [cat.name]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      return haystack.some((v) => v.includes(term));
    });
  }, [categorySearchTerm, categories]);

  // Funções de exclusão múltipla
  const deleteSelectedCategories = () => {
    if (selectedCategories.length === 0) return;
    
    setConfirmationData({
      title: `Excluir ${selectedCategories.length} Categoria(s)`,
      message: `Tem certeza que deseja excluir ${selectedCategories.length} categoria(s) selecionada(s)? Esta ação é irreversível.`,
      onConfirm: async () => {
        const ids = selectedCategories.slice();
        await Promise.all(ids.map((id) => dbDeleteCategory(id)));
        setCategories(categories.filter(cat => !ids.includes(cat.id)));
        setSelectedCategories([]);
        setShowConfirmation(false);
      },
      variant: 'danger',
      confirmText: 'Excluir'
    });
    setShowConfirmation(true);
  };

  const deleteSelectedItems = () => {
    if (selectedItems.length === 0) return;
    
    setConfirmationData({
      title: `Excluir ${selectedItems.length} Item(s) do Cardápio`,
      message: `Tem certeza que deseja excluir ${selectedItems.length} item(s) selecionado(s) do cardápio? Esta ação é irreversível.`,
      onConfirm: async () => {
        const ids = selectedItems.slice();
        await Promise.all(ids.map((id) => dbDeleteProduct(id)));
        setMenuItems(menuItems.filter(item => !ids.includes(item.id)));
        setSelectedItems([]);
        setShowConfirmation(false);
      },
      variant: 'danger',
      confirmText: 'Excluir'
    });
    setShowConfirmation(true);
  };

  const deleteSelectedPayments = () => {
    if (selectedPayments.length === 0) return;
    
    setConfirmationData({
      title: `Excluir ${selectedPayments.length} Forma(s) de Pagamento`,
      message: `Tem certeza que deseja excluir ${selectedPayments.length} forma(s) de pagamento selecionada(s)?`,
      onConfirm: () => {
        const methodsToDelete = selectedPayments;
        setPaymentMethods(paymentMethods.filter(method => !methodsToDelete.includes(method)));
        setSelectedPayments([]);
        
        // Remover atalhos associados
        const newShortcuts = { ...paymentShortcuts };
        methodsToDelete.forEach(method => delete newShortcuts[method]);
        setPaymentShortcuts(newShortcuts);
        
        setShowConfirmation(false);
      },
      variant: 'danger',
      confirmText: 'Excluir'
    });
    setShowConfirmation(true);
  };

  const addGlobalObservation = () => {
    if (newObservation.trim() && !globalObservations.includes(newObservation.trim())) {
      setGlobalObservations([...globalObservations, newObservation.trim()]);
      setNewObservation('');
    }
  };

  const removeGlobalObservation = (obs: string) => {
    setGlobalObservations(globalObservations.filter(o => o !== obs));
  };
  
  // NOVO: Funções para Modificadores Obrigatórios
  const handleAddModifierOption = () => {
    if (newModifierOption.trim()) {
      setCurrentModifierOptions(prev => [...prev, newModifierOption.trim()]);
      setNewModifierOption('');
    }
  };
  
  const handleRemoveModifierOption = (option: string) => {
    setCurrentModifierOptions(prev => prev.filter(opt => opt !== option));
  };
  
  const handleAddModifierGroup = () => {
    if (!newModifierGroupName.trim() || currentModifierOptions.length === 0) {
      alert('O nome do grupo e pelo menos uma opção são obrigatórios.');
      return;
    }

    const newGroup: RequiredModifierGroup = {
      id: editingModifierGroupId || Date.now().toString(), // Use existing ID if editing
      name: newModifierGroupName.trim(),
      options: currentModifierOptions,
      active: newModifierGroupActive,
    };
    
    if (editingModifierGroupId) {
      // Update existing group
      setItemForm(prev => ({
        ...prev,
        requiredModifierGroups: prev.requiredModifierGroups.map(group => 
          group.id === editingModifierGroupId ? newGroup : group
        )
      }));
    } else {
      // Add new group
      setItemForm(prev => ({
        ...prev,
        requiredModifierGroups: [...prev.requiredModifierGroups, newGroup]
      }));
    }
    
    setNewModifierGroupName('');
    setCurrentModifierOptions([]);
    setNewModifierGroupActive(true);
    setEditingModifierGroupId(null); // Clear editing state
  };
  
  const handleRemoveModifierGroup = (groupId: string) => {
    setItemForm(prev => ({
      ...prev,
      requiredModifierGroups: prev.requiredModifierGroups.filter(g => g.id !== groupId)
    }));
  };


  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      alert('Nome da categoria é obrigatório');
      return;
    }

    if (editingCategory) {
      const updated = categories.map(cat => 
        cat.id === editingCategory.id 
          ? { ...cat, name: categoryForm.name, icon: categoryForm.icon, integrationCode: categoryForm.integrationCode }
          : cat
      );
      setCategories(updated);
      await upsertCategory({ id: editingCategory.id, name: categoryForm.name });
    } else {
      const id = await upsertCategory({ name: categoryForm.name });
      const newCategory: Category = {
        id,
        name: categoryForm.name,
        icon: categoryForm.icon,
        order: categories.length + 1,
        active: true,
        integrationCode: categoryForm.integrationCode
      };
      setCategories([...categories, newCategory]);
    }

    setShowCategoryModal(false);
    setEditingCategory(null);
    resetForms();
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.price || !itemForm.sla || !itemForm.categoryId) {
      alert('Todos os campos obrigatórios devem ser preenchidos');
      return;
    }

    const itemData = {
      name: itemForm.name,
      price: parseFloat(itemForm.price),
      sla: parseInt(itemForm.sla),
      categoryId: itemForm.categoryId,
      observations: itemForm.observations,
      requiredModifierGroups: itemForm.requiredModifierGroups, // SALVANDO NOVO CAMPO
      image: undefined,
      active: editingItem ? editingItem.active : true, // Mantém o status ativo/inativo se estiver editando
      integrationCode: itemForm.integrationCode,
      skipKitchen: !!itemForm.skipKitchen,
      // Entrega parcial sempre permitida
      allowPartialDelivery: true,
      // Sempre salvar contagem de unidades por item (padrão 1)
      unitDeliveryCount: Math.max(1, parseInt(String(itemForm.unitDeliveryCount || '1')))
    };

    if (editingItem) {
      const updated = menuItems.map(item => 
        item.id === editingItem.id ? { ...item, ...itemData } : item
      );
      setMenuItems(renumberItemCodes(updated));
      await upsertProduct({ id: editingItem.id, name: itemData.name, categoryId: itemData.categoryId || null, priceCents: Math.max(0, Math.round((itemData.price || 0) * 100)), isActive: itemData.active, sku: editingItem.code || null });
    } else {
      const id = await upsertProduct({ name: itemData.name, categoryId: itemData.categoryId || null, priceCents: Math.max(0, Math.round((itemData.price || 0) * 100)), isActive: itemData.active });
      const newItem: MenuItem = { id, ...itemData };
      const appended = [...menuItems, newItem];
      setMenuItems(renumberItemCodes(appended));
    }

    setShowItemModal(false);
    setEditingItem(null);
    resetForms();
  };

  const handleSavePayment = () => {
    if (!paymentForm.trim()) {
      alert('Nome da forma de pagamento é obrigatório');
      return;
    }

    if (editingPayment) {
      setPaymentMethods(paymentMethods.map(method => 
        method === editingPayment ? paymentForm : method
      ));
      
      // Atualizar atalho se o nome da forma de pagamento mudar
      if (editingPayment !== paymentForm) {
        const shortcut = paymentShortcuts[editingPayment];
        const newShortcuts = { ...paymentShortcuts };
        delete newShortcuts[editingPayment];
        if (shortcut) {
          newShortcuts[paymentForm] = shortcut;
        }
        setPaymentShortcuts(newShortcuts);
      }

    } else {
      setPaymentMethods([...paymentMethods, paymentForm]);
    }

    setShowPaymentModal(false);
    setEditingPayment('');
    setPaymentForm('');
  };

  const handleDeleteCategory = (category: Category) => {
    setConfirmationData({
      title: 'Excluir Categoria',
      message: (
        <>
          Tem certeza que deseja excluir a categoria: 
          <span className="font-bold text-red-700 block mt-1">"{category.name}"</span>?
          Todos os itens associados a ela permanecerão no cardápio, mas sem categoria.
        </>
      ),
      onConfirm: async () => {
        await dbDeleteCategory(category.id);
        setCategories(categories.filter(cat => cat.id !== category.id));
        setShowConfirmation(false);
      },
      variant: 'danger',
      confirmText: 'Excluir Categoria'
    });
    setShowConfirmation(true);
  };

  const handleDeleteItem = (item: MenuItem) => {
    setConfirmationData({
      title: 'Excluir Item do Cardápio',
      message: (
        <>
          Tem certeza que deseja excluir o item: 
          <span className="font-bold text-red-700 block mt-1">"{item.name}"</span>?
          Esta ação é irreversível.
        </>
      ),
      onConfirm: async () => {
        await dbDeleteProduct(item.id);
        setMenuItems(menuItems.filter(i => i.id !== item.id));
        setShowConfirmation(false);
      },
      variant: 'danger',
      confirmText: 'Excluir Item'
    });
    setShowConfirmation(true);
  };

  const handleDeletePayment = (method: string) => {
    setConfirmationData({
      title: 'Excluir Forma de Pagamento',
      message: (
        <>
          Tem certeza que deseja excluir a forma de pagamento: 
          <span className="font-bold text-red-700 block mt-1">"{method}"</span>?
          Isso pode afetar pedidos futuros.
        </>
      ),
      onConfirm: () => {
        setPaymentMethods(paymentMethods.filter(m => m !== method));
        
        // Remover atalho associado
        const newShortcuts = { ...paymentShortcuts };
        delete newShortcuts[method];
        setPaymentShortcuts(newShortcuts);
        
        setShowConfirmation(false);
      },
      variant: 'danger',
      confirmText: 'Excluir Forma'
    });
    setShowConfirmation(true);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, icon: category.icon, integrationCode: category.integrationCode || '' });
    setShowCategoryModal(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      price: item.price.toString(),
      sla: item.sla.toString(),
      categoryId: item.categoryId,
      observations: item.observations || [],
      requiredModifierGroups: item.requiredModifierGroups || [], // CARREGANDO NOVO CAMPO
      image: item.image || '',
      code: item.code || '',
      integrationCode: item.integrationCode || '',
      skipKitchen: !!item.skipKitchen,
      allowPartialDelivery: !!item.allowPartialDelivery,
      unitDeliveryCount: item.unitDeliveryCount ? String(item.unitDeliveryCount) : ''
    });
    setImagePreview(item.image || '');
    setImageFile(null);
    
    // Resetar estados temporários de modificadores
    setNewModifierGroupName('');
    setNewModifierOption('');
    setCurrentModifierOptions([]);
    setNewModifierGroupActive(true);
    setEditingModifierGroupId(null); // Resetar ID de edição ao abrir para um novo item ou edição inicial
    
    setShowItemModal(true);
  };

  const openEditPayment = (method: string) => {
    setEditingPayment(method);
    setPaymentForm(method);
    setShowPaymentModal(true);
  };

  const addObservation = () => {
    if (newObservation.trim() && !itemForm.observations.includes(newObservation.trim())) {
      setItemForm({
        ...itemForm,
        observations: [...itemForm.observations, newObservation.trim()]
      });
      setNewObservation('');
    }
  };
  
  const handleNewObservationKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addObservation();
    }
  };

  const removeObservation = (obs: string) => {
    setItemForm({
      ...itemForm,
      observations: itemForm.observations.filter(o => o !== obs)
    });
  };

  // Opções de ícones para categorias
  const iconOptions = [
    // Comidas Principais
    { value: 'ri-restaurant-line', label: 'Pratos Principais', icon: 'ri-restaurant-line' },
    { value: 'ri-restaurant-2-line', label: 'Restaurante', icon: 'ri-restaurant-2-line' },
    { value: 'ri-bowl-line', label: 'Sopas e Caldos', icon: 'ri-bowl-line' },
    { value: 'ri-cake-3-line', label: 'Lanches', icon: 'ri-cake-3-line' },
    { value: 'ri-knife-line', label: 'Carnes', icon: 'ri-knife-line' },
    { value: 'ri-plant-line', label: 'Saladas', icon: 'ri-plant-line' },

    // Fast Food
    { value: 'ri-cake-line', label: 'Hambúrguer', icon: 'ri-cake-line' },
    { value: 'ri-cake-2-line', label: 'Pizza', icon: 'ri-cake-2-line' },
    { value: 'ri-cake-3-fill', label: 'Donuts', icon: 'ri-cake-3-fill' },
    { value: 'ri-cookie-line', label: 'Biscoitos e Cookies', icon: 'ri-cookie-line' },

    // Bebidas Quentes
    { value: 'ri-cup-line', label: 'Cafés e Chás', icon: 'ri-cup-line' },
    { value: 'ri-cup-fill', label: 'Bebidas Quentes', icon: 'ri-cup-fill' },

    // Bebidas Alcoólicas
    { value: 'ri-beer-line', label: 'Cervejas', icon: 'ri-beer-line' },
    { value: 'ri-wine-line', label: 'Vinhos', icon: 'ri-wine-line' },
    { value: 'ri-goblet-line', label: 'Drinks e Coquetéis', icon: 'ri-goblet-line' },
    { value: 'ri-bottle-line', label: 'Destilados', icon: 'ri-bottle-line' },

    // Bebidas Não Alcoólicas
    { value: 'ri-drop-line', label: 'Sucos e Refrigerantes', icon: 'ri-drop-line' },
    { value: 'ri-water-percent-line', label: 'Águas e Isotônicos', icon: 'ri-water-percent-line' },
    { value: 'ri-glass-line', label: 'Bebidas Geladas', icon: 'ri-glass-line' },
    { value: 'ri-soda-line', label: 'Refrigerante (lata)', icon: 'ri-soda-line' },
    { value: 'ri-soda-fill', label: 'Refrigerante (lata)', icon: 'ri-soda-fill' },

    // Doces e Sobremesas
    { value: 'ri-cake-fill', label: 'Bolos e Tortas', icon: 'ri-cake-fill' },
    { value: 'ri-cake-2-fill', label: 'Doces e Sobremesas', icon: 'ri-cake-2-fill' },
    { value: 'ri-snowflake-line', label: 'Sorvetes e Gelados', icon: 'ri-snowflake-line' },
    { value: 'ri-snowflake-fill', label: 'Pratos Frios', icon: 'ri-snowflake-fill' },

    // Frutas e Naturais
    { value: 'ri-apple-line', label: 'Frutas e Saladas', icon: 'ri-apple-line' },
    { value: 'ri-leaf-line', label: 'Vegetariano/Vegano', icon: 'ri-leaf-line' },
    { value: 'ri-seedling-line', label: 'Orgânicos', icon: 'ri-seedling-line' },
    { value: 'ri-flower-line', label: 'Produtos Naturais', icon: 'ri-flower-line' },

    // Características Especiais
    { value: 'ri-fire-line', label: 'Pratos Picantes', icon: 'ri-fire-line' },
    { value: 'ri-sun-line', label: 'Pratos Quentes', icon: 'ri-sun-line' },
    { value: 'ri-heart-line', label: 'Favoritos dos Clientes', icon: 'ri-heart-line' },
    { value: 'ri-star-line', label: 'Especialidades da Casa', icon: 'ri-star-line' },
    { value: 'ri-award-line', label: 'Prêmios e Destaques', icon: 'ri-award-line' },

    // Serviços e Promoções
    { value: 'ri-gift-line', label: 'Promoções', icon: 'ri-gift-line' },
    { value: 'ri-money-dollar-circle-line', label: 'Combos Econômicos', icon: 'ri-money-dollar-circle-line' },
    { value: 'ri-time-line', label: 'Preparo Rápido', icon: 'ri-time-line' },
    { value: 'ri-home-line', label: 'Receitas Caseiras', icon: 'ri-home-line' },
    { value: 'ri-truck-line', label: 'Delivery', icon: 'ri-truck-line' },

    // Períodos do Dia
    { value: 'ri-sun-cloudy-line', label: 'Café da Manhã', icon: 'ri-sun-cloudy-line' },
    { value: 'ri-sun-fill', label: 'Almoço', icon: 'ri-sun-fill' },
    { value: 'ri-moon-line', label: 'Jantar', icon: 'ri-moon-line' },
    { value: 'ri-moon-fill', label: 'Noturno', icon: 'ri-moon-fill' },

    // Tipos de Cozinha
    { value: 'ri-earth-line', label: 'Cozinha Internacional', icon: 'ri-earth-line' },
    { value: 'ri-map-pin-line', label: 'Cozinha Regional', icon: 'ri-map-pin-line' },
    { value: 'ri-building-line', label: 'Cozinha Urbana', icon: 'ri-building-line' },

    // Frutos do Mar
    { value: 'ri-fish-line', label: 'Peixes e Frutos do Mar', icon: 'ri-fish-line' },

    // Adicionais e Acompanhamentos
    { value: 'ri-add-circle-line', label: 'Adicionais', icon: 'ri-add-circle-line' },
    { value: 'ri-more-line', label: 'Acompanhamentos', icon: 'ri-more-line' },
    { value: 'ri-checkbox-multiple-line', label: 'Opcionais', icon: 'ri-checkbox-multiple-line' },

    // Infantil
    { value: 'ri-emotion-happy-line', label: 'Menu Infantil', icon: 'ri-emotion-happy-line' },
    { value: 'ri-emotion-laugh-line', label: 'Kids', icon: 'ri-emotion-laugh-line' },

    // Fitness e Saudável
    { value: 'ri-heart-pulse-line', label: 'Fitness', icon: 'ri-heart-pulse-line' },
    { value: 'ri-run-line', label: 'Saudável', icon: 'ri-run-line' },

    // Bebidas Especiais
    { value: 'ri-coffee-line', label: 'Café Especial', icon: 'ri-coffee-line' },
    { value: 'ri-tea-line', label: 'Chás', icon: 'ri-tea-line' },

    // Gastronomia adicional
    { value: 'ri-ice-cream-line', label: 'Sorvetes', icon: 'ri-ice-cream-line' },
    { value: 'ri-ice-cream-fill', label: 'Sorvetes', icon: 'ri-ice-cream-fill' },
    { value: 'ri-takeaway-line', label: 'Para Viagem', icon: 'ri-takeaway-line' },
    { value: 'ri-takeaway-fill', label: 'Para Viagem', icon: 'ri-takeaway-fill' },

    // Comidas Regionais
    { value: 'ri-restaurant-fill', label: 'Comida Regional', icon: 'ri-restaurant-fill' },
    { value: 'ri-bowl-fill', label: 'Sopas Especiais', icon: 'ri-bowl-fill' },

    // Massas e Pães
    { value: 'ri-bread-line', label: 'Pães e Massas', icon: 'ri-bread-line' },

    // Grelhados
    { value: 'ri-knife-fill', label: 'Grelhados', icon: 'ri-knife-fill' },

    // Vegetais
    { value: 'ri-plant-fill', label: 'Vegetais', icon: 'ri-plant-fill' },

    // Especiais da Casa
    { value: 'ri-star-fill', label: 'Especiais', icon: 'ri-star-fill' },
    { value: 'ri-heart-fill', label: 'Favoritos', icon: 'ri-heart-fill' },
    { value: 'ri-award-fill', label: 'Premiados', icon: 'ri-award-fill' },

    // Promoções e Ofertas
    { value: 'ri-gift-fill', label: 'Ofertas', icon: 'ri-gift-fill' },
    { value: 'ri-price-tag-3-line', label: 'Promoções', icon: 'ri-price-tag-3-line' },
    { value: 'ri-coupon-line', label: 'Cupons', icon: 'ri-coupon-line' },

    // Serviços
    { value: 'ri-service-line', label: 'Serviços', icon: 'ri-service-line' },
    { value: 'ri-customer-service-line', label: 'Atendimento', icon: 'ri-customer-service-line' },

    // Horários
    { value: 'ri-time-fill', label: 'Horário Especial', icon: 'ri-time-fill' },
    { value: 'ri-calendar-line', label: 'Agenda', icon: 'ri-calendar-line' },

    // Localização
    { value: 'ri-map-pin-fill', label: 'Local Especial', icon: 'ri-map-pin-fill' },
    { value: 'ri-store-line', label: 'Loja', icon: 'ri-store-line' },

    // Temperatura
    { value: 'ri-temp-hot-line', label: 'Quente', icon: 'ri-temp-hot-line' },
    { value: 'ri-temp-cold-line', label: 'Gelado', icon: 'ri-temp-cold-line' },

    // Diversos
    { value: 'ri-shopping-bag-line', label: 'Para Viagem', icon: 'ri-shopping-bag-line' },
    { value: 'ri-user-line', label: 'Individual', icon: 'ri-user-line' },
    { value: 'ri-group-line', label: 'Família', icon: 'ri-group-line' },
    { value: 'ri-vip-crown-line', label: 'VIP', icon: 'ri-vip-crown-line' },
    { value: 'ri-medal-line', label: 'Premium', icon: 'ri-medal-line' },
    { value: 'ri-flashlight-line', label: 'Destaque', icon: 'ri-flashlight-line' }
  ];

  const tabs = [
    { id: 'categories', name: 'Categorias', icon: 'ri-folder-line' },
    { id: 'items', name: 'Cardápio', icon: 'ri-restaurant-line' },
    { id: 'payments', name: 'Pagamentos', icon: 'ri-money-dollar-circle-line' },
    { id: 'shortcuts', name: 'Atalhos', icon: 'ri-keyboard-line' },
    { id: 'general', name: 'Geral', icon: 'ri-settings-line' }
  ];

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      
      // Criar preview da imagem
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
        setItemForm({ ...itemForm, image: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
    setItemForm({ ...itemForm, image: '' });
  };

  // Função de reorder das categorias
  const handleReorderCategory = (categoryId: string, direction: 'up' | 'down') => {
    const categoryIndex = categories.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1) return;

    const newCategories = [...categories];
    const currentCategory = newCategories[categoryIndex];
    
    if (direction === 'up' && categoryIndex > 0) {
      const previousCategory = newCategories[categoryIndex - 1];
      // Trocar as ordens
      const tempOrder = currentCategory.order;
      currentCategory.order = previousCategory.order;
      previousCategory.order = tempOrder;
    } else if (direction === 'down' && categoryIndex < newCategories.length - 1) {
      const nextCategory = newCategories[categoryIndex + 1];
      // Trocar as ordens
      const tempOrder = currentCategory.order;
      currentCategory.order = nextCategory.order;
      nextCategory.order = tempOrder;
    }

    setCategories(newCategories);
  };

  // Função para renumerar códigos dos itens conforme posição na lista
  const renumberItemCodes = (items: MenuItem[]) => {
    return items.map((it, idx) => ({ ...it, code: String(idx + 1) }));
  };

  // Reordenar itens via índices (suporta arrastar e soltar)
  const reorderItemsByIndex = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newItems = [...menuItems];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, moved);
    setMenuItems(renumberItemCodes(newItems));
  };

  // Auto-scroll da janela ao arrastar próximo das bordas do viewport
  const handleDragOverWithAutoScroll = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (dragOverItemIndex !== index) setDragOverItemIndex(index);
    const threshold = 80; // px
    const speed = 20; // px por evento
    const y = e.clientY;
    const vh = window.innerHeight;
    if (y < threshold) {
      window.scrollBy({ top: -speed, behavior: 'auto' });
    } else if (y > vh - threshold) {
      window.scrollBy({ top: speed, behavior: 'auto' });
    }
    // Reordenar imediatamente ao passar por cima
    if (draggedItemIndex !== null && draggedItemIndex !== index) {
      reorderItemsByIndex(draggedItemIndex, index);
      setDraggedItemIndex(index);
    }
  };

  // Reordenar categorias por ID (atualiza 'order')
  const reorderCategoriesById = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    const fromIndex = sorted.findIndex(c => c.id === fromId);
    const toIndex = sorted.findIndex(c => c.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    if (fromIndex === toIndex) return;
    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);
    // Renumera orders sequencialmente
    const updated = sorted.map((c, i) => ({ ...c, order: i + 1 }));
    setCategories(updated);
  };

  // DragOver para categorias com auto-scroll e reorder imediato
  const handleCategoryDragOverWithAutoScroll = (e: React.DragEvent<HTMLDivElement>, toId: string) => {
    e.preventDefault();
    if (dragOverCategoryId !== toId) setDragOverCategoryId(toId);
    const threshold = 80; // px
    const speed = 20; // px por evento
    const y = e.clientY;
    const vh = window.innerHeight;
    if (y < threshold) {
      window.scrollBy({ top: -speed, behavior: 'auto' });
    } else if (y > vh - threshold) {
      window.scrollBy({ top: speed, behavior: 'auto' });
    }
    // Reordenar imediatamente ao passar por cima, mantendo o ID arrastado
    if (draggedCategoryId && draggedCategoryId !== toId) {
      const sorted = [...categories].sort((a, b) => a.order - b.order);
      const fromIndex = sorted.findIndex(c => c.id === draggedCategoryId);
      const toIndex = sorted.findIndex(c => c.id === toId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
      reorderCategoriesById(draggedCategoryId, toId);
    }
  };

  // Função de reorder dos itens do cardápio (global)
  const handleReorderItem = (itemId: string, direction: 'up' | 'down') => {
    const index = menuItems.findIndex(i => i.id === itemId);
    if (index === -1) return;

    const newItems = [...menuItems];
    if (direction === 'up' && index > 0) {
      const tmp = newItems[index - 1];
      newItems[index - 1] = newItems[index];
      newItems[index] = tmp;
    } else if (direction === 'down' && index < newItems.length - 1) {
      const tmp = newItems[index + 1];
      newItems[index + 1] = newItems[index];
      newItems[index] = tmp;
    }

    setMenuItems(renumberItemCodes(newItems));
  };

  const handleConfigChange = (key: string, value: any) => {
    setAppConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleShortcutChange = (method: string, shortcut: string) => {
    const upperShortcut = shortcut.toUpperCase().slice(0, 1);
    
    // Verificar se o atalho já está em uso por outra forma de pagamento
    const existingMethod = Object.keys(paymentShortcuts).find(
      key => paymentShortcuts[key] === upperShortcut && key !== method
    );

    if (existingMethod && upperShortcut) {
      alert(`O atalho "${upperShortcut}" já está sendo usado pela forma de pagamento "${existingMethod}".`);
      return;
    }

    setPaymentShortcuts(prev => ({
      ...prev,
      [method]: upperShortcut
    }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      
      {/* Cabeçalho Fixo */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        </div>
        
        <div className="px-6">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as ConfigTab);
                  resetSelections();
                }}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <i className={`${tab.icon} mr-2`}></i>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conteúdo Rolável */}
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        {activeTab === 'categories' && (
          <div className="space-y-6 overflow-y-auto" ref={categoriesContainerRef} onDragOverCapture={handleDragOverViewport}>
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-gray-900">Categorias</h2>
                <Input
                  type="text"
                  value={categorySearchTerm}
                  onChange={(e) => setCategorySearchTerm(e.target.value)}
                  placeholder="Pesquisar"
                  className="w-72"
                />
              </div>
              <div className="flex space-x-3">
                {selectedCategories.length > 0 && (
                  <Button 
                    variant="secondary" 
                    onClick={deleteSelectedCategories}
                    className="bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    <i className="ri-delete-bin-line mr-2"></i>
                    Excluir Selecionados ({selectedCategories.length})
                  </Button>
                )}
                <Button onClick={() => setShowCategoryModal(true)}>
                  <i className="ri-add-line mr-2"></i>
                  Nova Categoria
                </Button>
              </div>
            </div>

            {categories.length > 0 && (
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCategories.length === categories.length}
                    onChange={selectAllCategories}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>Selecionar todos</span>
                </label>
                {selectedCategories.length > 0 && (
                  <span className="text-amber-600 font-medium">
                    {selectedCategories.length} de {categories.length} selecionados
                  </span>
                )}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="divide-y divide-gray-200">
                {filteredCategories.length === 0 && (
                  <div className="p-4 text-sm text-gray-500 italic">Nenhuma categoria encontrada</div>
                )}
                {filteredCategories
                  .sort((a, b) => a.order - b.order)
                  .map((category, index) => (
                  <div
                    key={category.id}
                    className={`p-4 flex items-center justify-between transition-colors transition-all duration-200 ease-out group ${
                      selectedCategories.includes(category.id) ? 'bg-amber-50' : ''
                    } ${dragOverCategoryId === category.id ? 'ring-2 ring-amber-400' : ''} ${draggedCategoryId === category.id ? 'opacity-80' : ''}`}
                    onDragOver={(e) => handleCategoryDragOverWithAutoScroll(e, category.id)}
                    onDrop={(e) => { e.preventDefault(); setDraggedCategoryId(null); setDragOverCategoryId(null); stopAutoScroll(); detachGlobalDragOver(); }}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category.id)}
                        onChange={() => toggleCategorySelection(category.id)}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span
                        className="text-gray-400 cursor-grab"
                        title="Arrastar para reordenar"
                        draggable
                        onDragStart={(e) => { setDraggedCategoryId(category.id); dragClientYRef.current = e.clientY; attachGlobalDragOver(); startAutoScroll(); }}
                        onDragEnd={() => { setDraggedCategoryId(null); setDragOverCategoryId(null); stopAutoScroll(); detachGlobalDragOver(); }}
                      >
                        <i className="ri-drag-move-line"></i>
                      </span>
                      <i className={`${category.icon} text-xl ${category.active ? 'text-amber-500' : 'text-gray-400'}`}></i>
                      <span className={`font-medium text-gray-900 ${!category.active ? 'line-through text-gray-500' : ''}`}>{category.name}</span>
                      <span className="text-sm text-gray-500">#{category.order}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      {/* Toggle de Ativação */}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={category.active}
                          onChange={() => toggleCategoryActive(category.id)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-900">
                          {category.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </label>
                      
                      <div className="flex space-x-2">
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => handleReorderCategory(category.id, 'up')}
                            disabled={index === 0}
                            className={`w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors ${
                              index === 0
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                            title="Mover para cima"
                          >
                            <i className="ri-arrow-up-s-line text-sm"></i>
                          </button>
                          <button
                            onClick={() => handleReorderCategory(category.id, 'down')}
                            disabled={index === categories.length - 1}
                            className={`w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors ${
                              index === categories.length - 1
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                            title="Mover para baixo"
                          >
                            <i className="ri-arrow-down-s-line text-sm"></i>
                          </button>
                        </div>
                        <button
                          onClick={() => openEditCategory(category)}
                          className="text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          <i className="ri-edit-line"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          className="text-red-600 hover:text-red-800 cursor-pointer"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'items' && (
          <div className="space-y-6 overflow-y-auto" ref={itemsContainerRef} onDragOverCapture={handleDragOverViewport}>
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-gray-900">Cardápio</h2>
                <Input
                  type="text"
                  value={itemSearchTerm}
                  onChange={(e) => setItemSearchTerm(e.target.value)}
                  placeholder="Pesquisar"
                  className="w-72"
                />
              </div>
              <div className="flex space-x-3">
                {selectedItems.length > 0 && (
                  <Button 
                    variant="secondary" 
                    onClick={deleteSelectedItems}
                    className="bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    <i className="ri-delete-bin-line mr-2"></i>
                    Excluir Selecionados ({selectedItems.length})
                  </Button>
                )}
                <Button onClick={() => setShowItemModal(true)}>
                  <i className="ri-add-line mr-2"></i>
                  Novo Item
                </Button>
              </div>
            </div>

            {menuItems.length > 0 && (
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === menuItems.length}
                    onChange={selectAllItems}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>Selecionar todos</span>
                </label>
                {selectedItems.length > 0 && (
                  <span className="text-amber-600 font-medium">
                    {selectedItems.length} de {menuItems.length} selecionados
                  </span>
                )}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="divide-y divide-gray-200">
                {filteredMenuItems.length === 0 && (
                  <div className="p-4 text-sm text-gray-500 italic">Nenhum item encontrado</div>
                )}
                {filteredMenuItems.map((item) => {
                  const category = categories.find(c => c.id === item.categoryId);
                  const itemIndex = menuItems.findIndex(i => i.id === item.id);
                  return (
                    <div
                      key={item.id}
                      className={`p-4 flex items-center justify-between transition-colors transition-all duration-200 ease-out ${
                        selectedItems.includes(item.id) ? 'bg-amber-50' : ''
                      } ${dragOverItemIndex === itemIndex ? 'ring-2 ring-amber-400' : ''} ${draggedItemIndex === itemIndex ? 'opacity-80' : ''}`}
                      onDragOver={(e) => { handleDragOverWithAutoScroll(e, itemIndex); dragClientYRef.current = e.clientY; }}
                      onDrop={(e) => { e.preventDefault(); setDraggedItemIndex(null); setDragOverItemIndex(null); stopAutoScroll(); detachGlobalDragOver(); }}
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span
                          className="text-gray-400 cursor-grab"
                          title="Arrastar para reordenar"
                          draggable
                          onDragStart={(e) => { setDraggedItemIndex(itemIndex); dragClientYRef.current = e.clientY; attachGlobalDragOver(); startAutoScroll(); }}
                          onDragEnd={() => { setDraggedItemIndex(null); setDragOverItemIndex(null); stopAutoScroll(); detachGlobalDragOver(); }}
                        >
                          <i className="ri-drag-move-line"></i>
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`font-medium text-gray-900 ${!item.active ? 'line-through text-gray-500' : ''}`}>{item.name}</span>
                            <span className="text-sm text-gray-500">({category?.name || 'Sem Categoria'})</span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>R$ {item.price.toFixed(2)}</span>
                            <span>{item.sla} min</span>
                            {item.code && (
                              <span className="text-blue-600">#{item.code}</span>
                            )}
                            {item.observations && item.observations.length > 0 && (
                              <span className="text-amber-600">
                                {item.observations.length} observações
                              </span>
                            )}
                            {item.requiredModifierGroups && item.requiredModifierGroups.length > 0 && (
                              <span className="text-red-600 font-medium">
                                {item.requiredModifierGroups.length} grupos obrigatórios
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {/* Reorder Item */}
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => handleReorderItem(item.id, 'up')}
                            disabled={itemIndex === 0}
                            className={`w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors ${
                              itemIndex === 0
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                            title="Mover para cima"
                          >
                            <i className="ri-arrow-up-s-line text-sm"></i>
                          </button>
                          <button
                            onClick={() => handleReorderItem(item.id, 'down')}
                            disabled={itemIndex === menuItems.length - 1}
                            className={`w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors ${
                              itemIndex === menuItems.length - 1
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                            title="Mover para baixo"
                          >
                            <i className="ri-arrow-down-s-line text-sm"></i>
                          </button>
                        </div>
                        {/* Toggle de Ativação */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={item.active}
                            onChange={() => toggleItemActive(item.id)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                          <span className="ml-3 text-sm font-medium text-gray-900">
                            {item.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </label>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditItem(item)}
                            className="text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            <i className="ri-edit-line"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="text-red-600 hover:text-red-800 cursor-pointer"
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Formas de Pagamento</h2>
              <div className="flex space-x-3">
                {selectedPayments.length > 0 && (
                  <Button 
                    variant="secondary" 
                    onClick={deleteSelectedPayments}
                    className="bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    <i className="ri-delete-bin-line mr-2"></i>
                    Excluir Selecionados ({selectedPayments.length})
                  </Button>
                )}
                <Button onClick={() => setShowPaymentModal(true)}>
                  <i className="ri-add-line mr-2"></i>
                  Nova Forma
                </Button>
              </div>
            </div>

            {paymentMethods.length > 0 && (
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPayments.length === paymentMethods.length}
                    onChange={selectAllPayments}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>Selecionar todos</span>
                </label>
                {selectedPayments.length > 0 && (
                  <span className="text-amber-600 font-medium">
                    {selectedPayments.length} de {paymentMethods.length} selecionados
                  </span>
                )}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="divide-y divide-gray-200">
                {paymentMethods.map((method, index) => (
                  <div key={index} className={`p-4 flex items-center justify-between transition-colors ${
                    selectedPayments.includes(method) ? 'bg-amber-50' : ''
                  }`}>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedPayments.includes(method)}
                        onChange={() => togglePaymentSelection(method)}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span className="font-medium text-gray-900">{method}</span>
                      {paymentShortcuts[method] && (
                        <span className="text-xs font-bold bg-gray-200 px-2 py-0.5 rounded border" style={{ fontFamily: 'inherit' }}>
                          {paymentShortcuts[method]}
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditPayment(method)}
                        className="text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        <i className="ri-edit-line"></i>
                      </button>
                      <button
                        onClick={() => handleDeletePayment(method)}
                        className="text-red-600 hover:text-red-800 cursor-pointer"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Atalhos de Pedido e Pagamento</h2>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="divide-y divide-gray-200">
                {/* Atalho de Checkout - Padronizado */}
                <div className="p-4 flex items-center justify-between">
                  <span className="font-medium text-gray-900">Finalizar Pedido (Checkout)</span>
                  <div className="flex items-center space-x-3">
                    <Input
                      type="text"
                      value={appConfig.checkoutShortcut}
                      onChange={(e) => handleConfigChange('checkoutShortcut', e.target.value.toUpperCase().slice(0, 1))}
                      placeholder="Ex: F"
                      maxLength={1}
                      className="w-16 text-center uppercase"
                    />
                    <span className="text-sm text-gray-500">
                      Atalho atual: <span className="font-bold">{appConfig.checkoutShortcut || 'Nenhum'}</span>
                    </span>
                  </div>
                </div>
                
                {/* Atalhos de Pagamento */}
                <div className="p-4 border-t">
                  <h3 className="font-medium text-gray-900 mb-3">Atalhos de Formas de Pagamento</h3>
                  <p className="text-gray-600 text-sm mb-4">Defina uma única letra para usar como atalho rápido no checkout.</p>
                  <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
                    {paymentMethods.map((method) => (
                      <div key={method} className="p-4 flex items-center justify-between bg-white">
                        <span className="font-medium text-gray-900">{method}</span>
                        <div className="flex items-center space-x-3">
                          <Input
                            type="text"
                            value={paymentShortcuts[method] || ''}
                            onChange={(e) => handleShortcutChange(method, e.target.value)}
                            placeholder="Ex: P"
                            maxLength={1}
                            className="w-16 text-center uppercase"
                          />
                          <span className="text-sm text-gray-500">
                            Atalho atual: <span className="font-bold">{paymentShortcuts[method] || 'Nenhum'}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Configurações Gerais</h2>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="space-y-6">
                
                {/* Configuração de Formato de Senha */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Formato da Senha do Pedido</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Define se a senha de retirada do pedido deve ser numérica, alfabética ou alfanumérica.
                  </p>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => handleConfigChange('passwordFormat', 'numeric')}
                      className={`flex-1 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                        appConfig.passwordFormat === 'numeric'
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <i className="ri-hashtag text-xl mb-1"></i>
                      <div className="font-medium text-sm">Numérica (0-9)</div>
                    </button>
                    <button
                      onClick={() => handleConfigChange('passwordFormat', 'alphabetic')}
                      className={`flex-1 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                        appConfig.passwordFormat === 'alphabetic'
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <i className="ri-font-size-2 text-xl mb-1"></i>
                      <div className="font-medium text-sm">Alfabética (A-Z)</div>
                    </button>
                    <button
                      onClick={() => handleConfigChange('passwordFormat', 'alphanumeric')}
                      className={`flex-1 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                        appConfig.passwordFormat === 'alphanumeric'
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <i className="ri-text text-xl mb-1"></i>
                      <div className="font-medium text-sm">Alfanumérica</div>
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <h3 className="font-medium text-gray-900">Som de novo pedido</h3>
                    <p className="text-sm text-gray-500">Alerta sonoro quando chegar novo pedido na cozinha</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={appConfig.soundAlert}
                      onChange={(e) => handleConfigChange('soundAlert', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">Modo escuro</h3>
                    <p className="text-sm text-gray-500">Alternar entre tema claro e escuro</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={appConfig.darkMode}
                      onChange={(e) => {
                        handleConfigChange('darkMode', e.target.checked);
                        if (e.target.checked) {
                          document.documentElement.classList.add('dark');
                        } else {
                          document.documentElement.classList.remove('dark');
                        }
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">SLA padrão (minutos)</h3>
                  <Input
                    type="number"
                    value={appConfig.defaultSla}
                    onChange={(e) => handleConfigChange('defaultSla', parseInt(e.target.value) || 0)}
                    className="w-32"
                  />
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Nome do estabelecimento</h3>
                  <Input
                    type="text"
                    value={appConfig.establishmentName}
                    onChange={(e) => handleConfigChange('establishmentName', e.target.value)}
                    className="w-64"
                  />
                </div>

                {/* O campo de atalho de checkout foi movido para a aba 'shortcuts' */}

                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Observações Globais</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Observações que estarão disponíveis para todos os itens do cardápio
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex space-x-2">
                      <Input
                        value={newObservation}
                        onChange={(e) => setNewObservation(e.target.value)}
                        placeholder="Digite uma observação global..."
                        className="flex-1"
                      />
                      <Button onClick={addGlobalObservation} size="sm">
                        Adicionar
                      </Button>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Observações Globais Ativas:</h4>
                      {/* Adicionando rolagem à lista de observações globais */}
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {globalObservations.map((obs, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800"
                          >
                            {obs}
                            <button
                              onClick={() => removeGlobalObservation(obs)}
                              className="ml-2 text-amber-600 hover:text-amber-800 cursor-pointer"
                            >
                              <i className="ri-close-line text-sm"></i>
                            </button>
                          </span>
                        ))}
                        {globalObservations.length === 0 && (
                          <p className="text-sm text-gray-500 italic">Nenhuma observação global configurada</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals de Confirmação */}
      {confirmationData && (
        <ConfirmationModal
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={confirmationData.onConfirm}
          title={confirmationData.title}
          message={confirmationData.message}
          variant={confirmationData.variant}
          confirmText={confirmationData.confirmText}
        />
      )}

      {/* Modal Categoria */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setEditingCategory(null);
          resetForms();
        }}
        title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Nome da categoria *"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            placeholder="Ex: Lanches, Bebidas..."
            required
          />

          <Input
            label="Código de integração (opcional)"
            type="number"
            value={categoryForm.integrationCode || ''}
            onChange={(e) => setCategoryForm({ ...categoryForm, integrationCode: e.target.value })}
            placeholder="Somente números"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ícone da categoria *
            </label>
            {/* Rolagem já estava aqui, mantida */}
            <Input
              type="text"
              value={iconSearchTerm}
              onChange={(e) => setIconSearchTerm(e.target.value)}
              placeholder="Pesquisar ícones..."
              className="w-full mb-2"
            />
            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {iconOptions
                .filter((opt) => {
                  const term = iconSearchTerm.toLowerCase();
                  return !term || opt.label.toLowerCase().includes(term) || opt.value.toLowerCase().includes(term);
                })
                .map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategoryForm({ ...categoryForm, icon: option.value })}
                  className={`p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-gray-50 ${
                    categoryForm.icon === option.value
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200'
                  }`}
                  title={option.label}
                >
                  <i className={`${option.icon} text-xl ${
                    categoryForm.icon === option.value ? 'text-amber-600' : 'text-gray-600'
                  }`}></i>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Ícone selecionado: <i className={`${categoryForm.icon} mr-1`}></i>
              {iconOptions.find(opt => opt.value === categoryForm.icon)?.label}
            </p>
          </div>

          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCategoryModal(false);
                setEditingCategory(null);
                resetForms();
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveCategory} className="flex-1">
              {editingCategory ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Item */}
      <Modal
        isOpen={showItemModal}
        onClose={() => {
          setShowItemModal(false);
          setEditingItem(null);
          resetForms();
        }}
        title={editingItem ? 'Editar Item' : 'Novo Item'}
        size="lg" // Aumentando o tamanho para acomodar as novas opções
      >
        <div className="space-y-4">
          <Input
            label="Nome do item *"
            value={itemForm.name}
            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
            placeholder="Ex: X-Burger, Coca-Cola..."
            required
          />

          <Input
            label="Código do item (automático)"
            type="number"
            value={itemForm.code}
            readOnly
            disabled
            placeholder="Gerado pela posição na lista"
          />

          <Input
            label="Código de integração (opcional)"
            type="number"
            value={itemForm.integrationCode || ''}
            onChange={(e) => setItemForm({ ...itemForm, integrationCode: e.target.value })}
            placeholder="Somente números"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Preço *"
              type="number"
              step="0.01"
              value={itemForm.price}
              onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
              placeholder="0.00"
              required
            />

            <Input
              label="SLA (minutos) *"
              type="number"
              value={itemForm.sla}
              onChange={(e) => setItemForm({ ...itemForm, sla: e.target.value })}
              placeholder="15"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria *
            </label>
            <select
              value={itemForm.categoryId}
              onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent pr-8"
              required
            >
              <option value="">Selecione uma categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
      </div>

          {/* NOVO: Toggle para pular Cozinha (Entrega Direta) */}
          <div className="pt-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={!!itemForm.skipKitchen}
                onChange={(e) => setItemForm({ ...itemForm, skipKitchen: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-900">Pular Cozinha (Entrega Direta)</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Quando ativo, o item não gera unidades de produção nem aparece na Cozinha.</p>
          </div>

          {/* Campo de unidades removido da edição de item conforme solicitado */}

          
          
          {/* NOVO: Grupos de Modificadores Obrigatórios */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="font-medium text-gray-900 mb-2 flex items-center">
              <i className="ri-checkbox-circle-line mr-2 text-red-600"></i>
              Grupos de Opções Obrigatórias (Seleção Única)
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Crie grupos onde o operador deve selecionar exatamente uma opção.
            </p>
            
            {/* Adicionar Novo Grupo */}
            <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 space-y-3 mb-4">
              <h4 className="font-medium text-blue-800">Novo Grupo / Editar Selecionado</h4>
              <Input
                value={newModifierGroupName}
                onChange={(e) => setNewModifierGroupName(e.target.value)}
                placeholder="Nome do Grupo (Ex: Ponto da Carne)"
              />
              
              <div className="flex space-x-2">
                <Input
                  value={newModifierOption}
                  onChange={(e) => setNewModifierOption(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddModifierOption()}
                  placeholder="Opção (Ex: Mal Passada)"
                  className="flex-1"
                />
                <Button onClick={handleAddModifierOption} size="sm" variant="info" disabled={!newModifierOption.trim()}>
                  + Opção
                </Button>
              </div>
              
              {currentModifierOptions.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 border-t border-blue-200 pt-3">
                  {currentModifierOptions.map((option, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {option}
                      <button
                        onClick={() => handleRemoveModifierOption(option)}
                        className="ml-1 text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        <i className="ri-close-line text-xs"></i>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {/* Toggle de Ativação do Novo Grupo */}
              <div className="flex items-center justify-between pt-3 border-t border-blue-200">
                <h5 className="text-sm font-medium text-blue-800">Status do Grupo:</h5>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={newModifierGroupActive}
                    onChange={(e) => setNewModifierGroupActive(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    {newModifierGroupActive ? 'Ativo' : 'Inativo'}
                  </span>
                </label>
              </div>
              
              <Button onClick={handleAddModifierGroup} disabled={!newModifierGroupName.trim() || currentModifierOptions.length === 0} className="w-full" variant="primary">
                <i className="ri-add-line mr-2"></i>
                Adicionar/Atualizar Grupo
              </Button>
            </div>
            
            {/* Lista de Grupos Ativos */}
            {itemForm.requiredModifierGroups.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {itemForm.requiredModifierGroups.map(group => (
                  <div key={group.id} className={`p-3 flex items-center justify-between bg-white ${!group.active ? 'bg-gray-50' : ''}`}>
                    <div className="flex-1 min-w-0 pr-4">
                      <span className={`font-medium text-gray-900 block truncate ${!group.active ? 'line-through text-gray-500' : ''}`}>{group.name}</span>
                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-1">
                        {group.options.map((option, index) => (
                          <span key={index} className="bg-gray-100 px-1 rounded">{option}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={group.active}
                          onChange={() => toggleModifierGroupActive(group.id)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          // Carregar para edição
                          setNewModifierGroupName(group.name);
                          setCurrentModifierOptions(group.options);
                          setNewModifierGroupActive(group.active);
                          setEditingModifierGroupId(group.id); // Definir o ID do grupo que está sendo editado
                        }}
                      >
                        <i className="ri-edit-line"></i>
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveModifierGroup(group.id)}
                      >
                        <i className="ri-delete-bin-line"></i>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observações Opcionais (Antigas) */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="font-medium text-gray-900 mb-2 flex items-center">
              <i className="ri-information-line mr-2 text-amber-600"></i>
              Observações Opcionais
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Observações que o operador PODE adicionar ao item.
            </p>
            <div className="flex space-x-2 mb-2">
              <Input
                value={newObservation}
                onChange={(e) => setNewObservation(e.target.value)}
                onKeyPress={handleNewObservationKeyPress}
                placeholder="Digite uma observação..."
                className="flex-1"
              />
              <Button onClick={addObservation} size="sm">
                Adicionar
              </Button>
            </div>
            {/* Adicionando rolagem à lista de observações do item */}
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
              {itemForm.observations.map((obs, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                >
                  {obs}
                  <button
                    onClick={() => removeObservation(obs)}
                    className="ml-1 text-amber-600 hover:text-amber-800 cursor-pointer"
                  >
                    <i className="ri-close-line text-xs"></i>
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowItemModal(false);
                setEditingItem(null);
                resetForms();
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveItem} className="flex-1">
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Pagamento */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setEditingPayment('');
          setPaymentForm('');
        }}
        title={editingPayment ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Nome da forma de pagamento *"
            value={paymentForm}
            onChange={(e) => setPaymentForm(e.target.value)}
            placeholder="Ex: PIX, Dinheiro, Cartão..."
            required
          />

          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowPaymentModal(false);
                setEditingPayment('');
                setPaymentForm('');
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleSavePayment} className="flex-1">
              {editingPayment ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
