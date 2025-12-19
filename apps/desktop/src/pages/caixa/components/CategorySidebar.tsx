import type { Category } from '../../../types';

interface Kitchen {
  id: string;
  name: string;
}

interface CategorySidebarProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  onReorderCategory: (categoryId: string, direction: 'up' | 'down') => void;
  kitchens?: Kitchen[];
  selectedKitchenId?: string | null;
  onKitchenChange?: (kitchenId: string | null) => void;
  categoryIdsByKitchen?: Record<string, string[]>;
}

export default function CategorySidebar({ 
  categories, 
  selectedCategory, 
  onSelectCategory, 
  onReorderCategory,
  kitchens = [],
  selectedKitchenId = null,
  onKitchenChange,
  categoryIdsByKitchen = {}
}: CategorySidebarProps) {
  // Filtrar categorias por cozinha selecionada
  const filteredCategories = categories.filter(category => {
    if (!selectedKitchenId) return true; // Mostrar todas se nenhuma cozinha selecionada
    const allowedCategoryIds = categoryIdsByKitchen[selectedKitchenId] || [];
    return allowedCategoryIds.includes(String(category.id));
  });

  const activeCategories = filteredCategories
    .filter(category => (category.active ?? true))
    .sort((a, b) => a.order - b.order);

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col flex-shrink-0">
      
      {/* Filtro de Cozinha */}
      {kitchens.length > 0 && onKitchenChange && (
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            <i className="ri-restaurant-line mr-1"></i>
            Filtrar por Cozinha
          </label>
          <select
            value={selectedKitchenId || ''}
            onChange={(e) => onKitchenChange(e.target.value || null)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="">Todas as Cozinhas</option>
            {kitchens.map(k => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Cabeçalho com altura uniforme para alinhamento entre colunas */}
      <div className="h-12 px-4 border-b border-gray-200 flex items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Categorias</h2>
        {selectedKitchenId && (
          <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            Filtrado
          </span>
        )}
      </div>
      
      <div className="flex-1 min-h-0">
        <div className="h-full overflow-y-auto p-2 space-y-1">
          {activeCategories.map((category, index) => (
            <div
              key={category.id}
              className={`group relative flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                selectedCategory === category.id
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
              onClick={() => onSelectCategory(category.id)}
            >
              <span className="font-medium text-sm">{category.name}</span>
              
              <div className="flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorderCategory(category.id, 'up');
                  }}
                  disabled={index === 0}
                  className={`w-5 h-5 flex items-center justify-center rounded text-xs ${
                    index === 0 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200 cursor-pointer'
                  }`}
                >
                  <i className="ri-arrow-up-line"></i>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorderCategory(category.id, 'down');
                  }}
                  disabled={index === activeCategories.length - 1}
                  className={`w-5 h-5 flex items-center justify-center rounded text-xs ${
                    index === activeCategories.length - 1 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200 cursor-pointer'
                  }`}
                >
                  <i className="ri-arrow-down-line"></i>
                </button>
              </div>
            </div>
          ))}
          
          {activeCategories.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <i className="ri-folder-line text-3xl mb-2"></i>
              <p className="text-sm">Nenhuma categoria ativa</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
