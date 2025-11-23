import { useState, useMemo, useEffect } from 'react';
import type { MenuItem, RequiredModifierGroup } from '../../../types';
import Button from '../../../components/base/Button';
import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import * as inventory from '@/offline/services/inventoryService'

interface MenuGridProps {
  items: MenuItem[];
  onAddToCart: (item: MenuItem, observations?: string, discountPercentage?: number) => void;
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
}

export default function MenuGrid({ items, onAddToCart, selectedIndex = 0, onSelectIndex }: MenuGridProps) {
  const [showObservationsModal, setShowObservationsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<number>(0);
  
  // Estados para Modificadores Obrigatórios (Map<groupId, selectedOption>)
  const [selectedRequiredModifiers, setSelectedRequiredModifiers] = useState<Record<string, string>>({});
  
  // Estados para Observações Opcionais
  const [selectedOptionalObservations, setSelectedOptionalObservations] = useState<string[]>([]);
  const [customObservation, setCustomObservation] = useState('');
  
  const [globalObservations] = useLocalStorage<string[]>('globalObservations', []);

  const [showRecipeModal, setShowRecipeModal] = useState(false)
  const [recipeForItem, setRecipeForItem] = useState<any[]>([])
  const [ingredients, setIngredients] = useState<any[]>([])
  useEffect(() => { (async ()=>{ try { const ing = await inventory.listIngredients(); setIngredients(ing) } catch {} })() }, [])

  const openRecipeModal = async (item: MenuItem) => {
    try {
      const lines = await inventory.listRecipeByProduct(String(item.id))
      setRecipeForItem(lines)
      setShowRecipeModal(true)
    } catch {
      setRecipeForItem([])
      setShowRecipeModal(true)
    }
  }

  // NOVO: Função para obter apenas os grupos obrigatórios ATIVOS
  const getActiveRequiredModifierGroups = (item: MenuItem): RequiredModifierGroup[] => {
    if (!item || !Array.isArray(item.requiredModifierGroups)) return [];
    return item.requiredModifierGroups.filter(group => group.active);
  };

  const openSelectionModal = (item: MenuItem) => {
    setSelectedItem(item);
    // Sempre resetar estados ao abrir para um novo item
    setSelectedRequiredModifiers({});
    setSelectedOptionalObservations([]);
    setCustomObservation('');
    setSelectedDiscount(0);
    
    setShowObservationsModal(true);
  };

  // Lógica de seleção única por grupo
  const toggleRequiredModifier = (groupId: string, option: string) => {
    setSelectedRequiredModifiers(prev => ({
      ...prev,
      [groupId]: prev[groupId] === option ? '' : option // Seleção única
    }));
  };
  
  const toggleOptionalObservation = (observation: string) => {
    setSelectedOptionalObservations(prev =>
      prev.includes(observation)
        ? prev.filter(obs => obs !== observation)
        : [...prev, observation]
    );
  };

  const handleAddWithSelections = () => {
    if (!selectedItem) return;
    
    // Validação: Todos os grupos obrigatórios ATIVOS devem ter uma opção selecionada
    const requiredGroups = getActiveRequiredModifierGroups(selectedItem);
    const allRequiredSelected = requiredGroups.every(group => !!selectedRequiredModifiers[group.id]);
    
    if (requiredGroups.length > 0 && !allRequiredSelected) {
        alert('Selecione uma opção para todos os campos obrigatórios.');
        return;
    }

    // 1. Concatena Modificadores Obrigatórios (prefixados com [OBRIGATÓRIO] e o nome do grupo)
    const requiredPrefix = requiredGroups.map(group => {
        const selectedOption = selectedRequiredModifiers[group.id];
        return selectedOption ? `[OBRIGATÓRIO] ${group.name}: ${selectedOption}` : '';
    }).filter(p => p.length > 0).join(', ');
        
    // 2. Concatena Observações Opcionais
    const optionalText = selectedOptionalObservations.join(', ');
    
    // 3. Concatena Observação Personalizada
    const customText = customObservation.trim();

    // 4. Combina tudo, separando por vírgula e espaço
    const allParts = [requiredPrefix, optionalText, customText].filter(p => p.length > 0);
    const observationsText = allParts.length > 0 ? allParts.join(', ') : undefined;
    
    onAddToCart(selectedItem, observationsText, selectedDiscount);
    
    setShowObservationsModal(false);
    setSelectedItem(null);
  };

  const getAllAvailableObservations = (item: MenuItem) => {
    if (!item) return [];
    const itemObservations = item.observations || [];
    return [...new Set([...globalObservations, ...itemObservations])];
  };

  const hasOptionalObservations = (item: MenuItem) => {
    if (!item) return false;
    return getAllAvailableObservations(item).length > 0;
  };
  
  // ATUALIZADO: Verifica se há grupos obrigatórios ATIVOS
  const hasRequiredModifiers = (item: MenuItem) => {
    return getActiveRequiredModifierGroups(item).length > 0;
  };
  
  // REMOVIDO: requiresSelection, pois a lógica foi movida para a renderização dos botões.

  const [discounts, setDiscounts] = useState<Record<string, number>>({});

  if (items.length === 0) {
    return (
      <div className="flex-1 p-4 lg:p-6 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <i className="ri-restaurant-line text-4xl lg:text-6xl mb-4"></i>
          <p className="text-base lg:text-lg">Nenhuma categoria selecionada</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Removendo pt-4 para que o grid comece imediatamente após o título no componente pai */}
      <div className="flex-1 px-4 lg:px-6 pb-4 lg:pb-6 overflow-y-auto bg-gray-50">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 lg:gap-4">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${idx===selectedIndex ? 'border-amber-400 ring-2 ring-amber-300' : 'border-gray-200'}`}
              onClick={() => onSelectIndex?.(idx)}
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-32 lg:h-40 object-cover object-top"
                />
              )}
              
              <div className="p-3 lg:p-4">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base line-clamp-2 flex items-center">
                  {item.name}
                  {item.code && (
                    <span className="ml-2 text-blue-600 text-xs font-semibold">#{item.code}</span>
                  )}
                </h3>
                <p className="text-lg font-bold text-amber-600 mb-3">
                  R$ {item.price.toFixed(2)}
                </p>
                
                <div className="flex space-x-2 items-center">
                  {/* Se houver opções obrigatórias ATIVAS, o botão principal deve abrir o modal */}
                  {hasRequiredModifiers(item) ? (
                    <Button
                      onClick={() => openSelectionModal(item)}
                      className="flex-1"
                      size="sm"
                      variant="danger"
                    >
                      <i className="ri-checkbox-circle-line mr-2"></i>
                      Opções Obrigatórias
                    </Button>
                  ) : (
                    // Se não houver opções obrigatórias ATIVAS, o botão principal é "Adicionar"
                    <Button
                      // Se houver observações opcionais, o botão principal adiciona diretamente.
                      // O modal só é aberto pelo botão secundário.
                      onClick={() => onAddToCart(item, undefined, 0)}
                      className="flex-1"
                      size="sm"
                    >
                      Adicionar
                    </Button>
                  )}
                  
                  {/* Ficha técnica (somente leitura) */}
                  <Button
                    onClick={() => openRecipeModal(item)}
                    variant="secondary"
                    size="sm"
                    className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center p-0"
                  >
                    <i className="ri-file-list-3-line text-base lg:text-lg"></i>
                  </Button>

                  <Button
                    onClick={() => openSelectionModal(item)}
                    variant="secondary"
                    size="sm"
                    className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center p-0"
                  >
                    <i className="ri-add-line text-base lg:text-lg"></i>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        isOpen={showObservationsModal}
        onClose={() => setShowObservationsModal(false)}
        title={`Opções e Observações - ${selectedItem?.name}`}
        size="lg"
      >
        <div className="space-y-6">
          
          {/* Modificadores Obrigatórios */}
          {selectedItem && hasRequiredModifiers(selectedItem) && (
            <div className="p-4 border border-red-300 rounded-lg bg-red-50 space-y-4">
              <h4 className="font-bold text-red-800 flex items-center">
                <i className="ri-alert-line mr-2"></i>
                Opções Obrigatórias (Selecione 1 por grupo): *
              </h4>
              
              {getActiveRequiredModifierGroups(selectedItem).map((group) => (
                <div key={group.id} className="border border-red-200 rounded-lg p-3">
                    <h5 className="font-medium text-red-700 mb-2">{group.name}:</h5>
                    <div className="grid grid-cols-2 gap-2">
                        {group.options.map((option) => (
                            <button
                                key={option}
                                onClick={() => toggleRequiredModifier(group.id, option)}
                                className={`p-3 text-sm rounded-lg border-2 transition-colors cursor-pointer whitespace-nowrap ${
                                    selectedRequiredModifiers[group.id] === option
                                        ? 'bg-red-100 border-red-500 text-red-800 font-medium'
                                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    {!selectedRequiredModifiers[group.id] && (
                        <p className="text-xs text-red-600 mt-2">Seleção obrigatória.</p>
                    )}
                </div>
              ))}
            </div>
          )}
          
          {/* Observações Opcionais */}
          {selectedItem && hasOptionalObservations(selectedItem) && (
            <div className="p-4 border border-amber-300 rounded-lg bg-amber-50">
              <h4 className="font-medium text-amber-800 mb-3">Observações Opcionais:</h4>
              <div className="grid grid-cols-2 gap-2">
                {getAllAvailableObservations(selectedItem).map((observation) => (
                  <button
                    key={observation}
                    onClick={() => toggleOptionalObservation(observation)}
                    className={`p-2 text-sm rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      selectedOptionalObservations.includes(observation)
                        ? 'bg-amber-100 border-amber-500 text-amber-800'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {observation}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Observação personalizada */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observação personalizada:
            </label>
            <textarea
              value={customObservation}
              onChange={(e) => setCustomObservation(e.target.value)}
              placeholder="Digite uma observação específica..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">
              {customObservation.length}/500 caracteres
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Desconto (%):
            </label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                value={selectedDiscount.toString()}
                onChange={(e) => setSelectedDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="w-24"
                step="1"
                min="0"
                max="100"
              />
              <span className="text-sm">%</span>
            </div>
          </div>

          <div className="flex space-x-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowObservationsModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddWithSelections}
              className="flex-1"
              disabled={selectedItem && hasRequiredModifiers(selectedItem) && getActiveRequiredModifierGroups(selectedItem).some(group => !selectedRequiredModifiers[group.id])}
            >
              Adicionar ao Carrinho
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showRecipeModal}
        onClose={() => setShowRecipeModal(false)}
        title={`Ficha Técnica`}
        size="md"
      >
        <div className="space-y-2">
          {recipeForItem.length === 0 ? (
            <div className="text-sm text-gray-500">Nenhum insumo cadastrado</div>
          ) : (
            <div className="divide-y">
              {recipeForItem.map((r:any)=> (
                <div key={String(r.id)} className="py-1 flex items-center justify-between">
                  <div className="text-sm">{ingredients.find(i=>String(i.id)===String(r.ingredient_id))?.name || r.ingredient_id}</div>
                  <div className="text-sm">{r.quantity} {r.unit}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
