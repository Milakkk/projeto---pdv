import { useState, useMemo } from 'react';
import type { MenuItem, Category } from '../../../types';
import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import Button from '../../../components/base/Button';

interface CodeListModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  categories: Category[];
  onSelectCode: (code: string) => void;
}

export default function CodeListModal({ isOpen, onClose, menuItems, categories, onSelectCode }: CodeListModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const categoryMap = useMemo(() => {
    return categories.reduce((map, cat) => {
      map[cat.id] = cat.name;
      return map;
    }, {} as Record<string, string>);
  }, [categories]);

  const filteredItems = useMemo(() => {
    const activeItemsWithCode = menuItems.filter(item => item.active && item.code);
    
    if (!searchTerm) {
      return activeItemsWithCode;
    }
    const lowerCaseSearch = searchTerm.toLowerCase();
    return activeItemsWithCode.filter(item => {
      const categoryName = categoryMap[item.categoryId] || '';
      return (
        item.name.toLowerCase().includes(lowerCaseSearch) ||
        item.code!.toLowerCase().includes(lowerCaseSearch) ||
        categoryName.toLowerCase().includes(lowerCaseSearch) // Adicionando busca por categoria
      );
    });
  }, [menuItems, searchTerm, categoryMap]);

  const sortedItems = useMemo(() => {
    return filteredItems.sort((a, b) => {
      const catA = categoryMap[a.categoryId] || 'Sem Categoria';
      const catB = categoryMap[b.categoryId] || 'Sem Categoria';
      
      if (catA !== catB) {
        return catA.localeCompare(catB);
      }
      return a.name.localeCompare(b.name);
    });
  }, [filteredItems, categoryMap]);

  const handleSelect = (code: string) => {
    onSelectCode(code);
    setSearchTerm('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lista de Códigos de Itens"
      size="lg"
    >
      <div className="space-y-4">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nome, código ou categoria..."
          className="w-full"
          autoFocus
        />

        <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
          {sortedItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="ri-search-line text-3xl mb-2"></i>
              <p className="text-sm">Nenhum item encontrado com código</p>
            </div>
          ) : (
            sortedItems.map(item => (
              <div 
                key={item.id} 
                className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleSelect(item.code!)}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    <span className="text-gray-500 mr-2">[{categoryMap[item.categoryId] || 'Sem Categoria'}]</span>
                    {item.name}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">
                    {item.code}
                  </span>
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(item.code!);
                    }}
                    size="sm"
                    className="h-7 px-2"
                  >
                    <i className="ri-add-line"></i>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
