import type { Category } from '../../../types';

interface CategorySidebarProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  onReorderCategory: (categoryId: string, direction: 'up' | 'down') => void;
}

export default function CategorySidebar({ 
  categories, 
  selectedCategory, 
  onSelectCategory, 
  onReorderCategory 
}: CategorySidebarProps) {
  const activeCategories = categories
    .filter(category => (category.active ?? true))
    .sort((a, b) => a.order - b.order);

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col flex-shrink-0">
      
      {/* Cabeçalho com altura uniforme para alinhamento entre colunas */}
      <div className="h-16 px-4 border-b border-gray-200 flex items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Categorias</h2>
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
