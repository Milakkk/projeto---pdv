import { useState, useEffect, useCallback } from 'react';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';

interface Kitchen {
  id: string;
  name: string;
  is_active: number;
  display_order: number;
  updated_at: string;
}

export default function KitchensManager() {
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newKitchenName, setNewKitchenName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  const loadKitchens = useCallback(async () => {
    const api = (window as any)?.api;
    if (!api?.db?.query) return;

    try {
      setLoading(true);
      const result = await api.db.query('SELECT * FROM kitchens ORDER BY display_order, name');
      if (result?.rows) {
        setKitchens(result.rows);
      }
    } catch (err) {
      console.error('Erro ao carregar cozinhas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKitchens();

    // Escutar mudanças no DB
    const api = (window as any)?.api;
    if (api?.db?.onChange) {
      const unsub = api.db.onChange((payload: any) => {
        if (payload?.table === 'kitchens') {
          loadKitchens();
        }
      });
      return () => unsub?.();
    }
  }, [loadKitchens]);

  const handleCreate = async () => {
    if (!newKitchenName.trim()) return;

    const api = (window as any)?.api;
    if (!api?.db?.query) return;

    try {
      const id = `kitchen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const now = new Date().toISOString();
      const maxOrder = kitchens.reduce((max, k) => Math.max(max, k.display_order || 0), 0);

      await api.db.query(
        `INSERT INTO kitchens (id, name, is_active, display_order, updated_at, version, pending_sync) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, newKitchenName.trim(), 1, maxOrder + 1, now, 1, 1]
      );

      setNewKitchenName('');
      setShowNewForm(false);
      await loadKitchens();
    } catch (err) {
      console.error('Erro ao criar cozinha:', err);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;

    const api = (window as any)?.api;
    if (!api?.db?.query) return;

    try {
      const now = new Date().toISOString();
      await api.db.query(
        `UPDATE kitchens SET name = ?, updated_at = ?, pending_sync = 1 WHERE id = ?`,
        [editName.trim(), now, id]
      );

      setEditingId(null);
      setEditName('');
      await loadKitchens();
    } catch (err) {
      console.error('Erro ao atualizar cozinha:', err);
    }
  };

  const handleToggleActive = async (kitchen: Kitchen) => {
    const api = (window as any)?.api;
    if (!api?.db?.query) return;

    try {
      const now = new Date().toISOString();
      const newStatus = kitchen.is_active ? 0 : 1;
      await api.db.query(
        `UPDATE kitchens SET is_active = ?, updated_at = ?, pending_sync = 1 WHERE id = ?`,
        [newStatus, now, kitchen.id]
      );
      await loadKitchens();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta cozinha?')) return;

    const api = (window as any)?.api;
    if (!api?.db?.query) return;

    try {
      // Remover associações com categorias
      await api.db.query('UPDATE categories SET kitchen_id = NULL WHERE kitchen_id = ?', [id]);
      // Excluir cozinha
      await api.db.query('DELETE FROM kitchens WHERE id = ?', [id]);
      await loadKitchens();
    } catch (err) {
      console.error('Erro ao excluir cozinha:', err);
    }
  };

  const handleMoveOrder = async (kitchen: Kitchen, direction: 'up' | 'down') => {
    const api = (window as any)?.api;
    if (!api?.db?.query) return;

    const currentIndex = kitchens.findIndex(k => k.id === kitchen.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= kitchens.length) return;

    const targetKitchen = kitchens[targetIndex];
    const now = new Date().toISOString();

    try {
      await api.db.query(
        'UPDATE kitchens SET display_order = ?, updated_at = ? WHERE id = ?',
        [targetKitchen.display_order, now, kitchen.id]
      );
      await api.db.query(
        'UPDATE kitchens SET display_order = ?, updated_at = ? WHERE id = ?',
        [kitchen.display_order, now, targetKitchen.id]
      );
      await loadKitchens();
    } catch (err) {
      console.error('Erro ao reordenar:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Gerenciar Cozinhas</h3>
          <p className="text-sm text-gray-600">
            Configure as cozinhas disponíveis. Cada cozinha pode ter categorias de produtos associadas.
          </p>
        </div>
        <Button onClick={() => setShowNewForm(true)}>
          <i className="ri-add-line mr-2"></i>
          Nova Cozinha
        </Button>
      </div>

      {/* Formulário de nova cozinha */}
      {showNewForm && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <h4 className="font-medium text-emerald-800 mb-3">Nova Cozinha</h4>
          <div className="flex items-center gap-3">
            <Input
              value={newKitchenName}
              onChange={(e) => setNewKitchenName(e.target.value)}
              placeholder="Nome da cozinha"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={!newKitchenName.trim()}>
              <i className="ri-check-line mr-1"></i>
              Criar
            </Button>
            <Button variant="secondary" onClick={() => { setShowNewForm(false); setNewKitchenName(''); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Lista de cozinhas */}
      {kitchens.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <i className="ri-restaurant-2-line text-5xl text-gray-300 mb-4"></i>
          <p className="text-gray-500">Nenhuma cozinha cadastrada</p>
          <p className="text-sm text-gray-400">Clique em "Nova Cozinha" para adicionar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {kitchens.map((kitchen, index) => (
            <div
              key={kitchen.id}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                kitchen.is_active
                  ? 'bg-white border-gray-200 hover:border-emerald-300'
                  : 'bg-gray-50 border-gray-100 opacity-60'
              }`}
            >
              {/* Ordem */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleMoveOrder(kitchen, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <i className="ri-arrow-up-s-line"></i>
                </button>
                <button
                  onClick={() => handleMoveOrder(kitchen, 'down')}
                  disabled={index === kitchens.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <i className="ri-arrow-down-s-line"></i>
                </button>
              </div>

              {/* Ícone */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                kitchen.is_active ? 'bg-emerald-100' : 'bg-gray-200'
              }`}>
                <i className={`ri-restaurant-2-fill text-xl ${
                  kitchen.is_active ? 'text-emerald-600' : 'text-gray-400'
                }`}></i>
              </div>

              {/* Nome */}
              <div className="flex-1">
                {editingId === kitchen.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdate(kitchen.id);
                        if (e.key === 'Escape') { setEditingId(null); setEditName(''); }
                      }}
                    />
                    <button
                      onClick={() => handleUpdate(kitchen.id)}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded"
                    >
                      <i className="ri-check-line"></i>
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditName(''); }}
                      className="p-2 text-gray-400 hover:bg-gray-100 rounded"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                ) : (
                  <div>
                    <h4 className="font-medium text-gray-900">{kitchen.name}</h4>
                    <p className="text-xs text-gray-500">
                      {kitchen.is_active ? 'Ativa' : 'Inativa'} • Ordem: {kitchen.display_order}
                    </p>
                  </div>
                )}
              </div>

              {/* Ações */}
              {editingId !== kitchen.id && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingId(kitchen.id); setEditName(kitchen.name); }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    title="Editar"
                  >
                    <i className="ri-pencil-line"></i>
                  </button>
                  <button
                    onClick={() => handleToggleActive(kitchen)}
                    className={`p-2 rounded ${
                      kitchen.is_active
                        ? 'text-amber-600 hover:bg-amber-50'
                        : 'text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={kitchen.is_active ? 'Desativar' : 'Ativar'}
                  >
                    <i className={kitchen.is_active ? 'ri-toggle-fill' : 'ri-toggle-line'}></i>
                  </button>
                  <button
                    onClick={() => handleDelete(kitchen.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Excluir"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dica */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <i className="ri-information-line text-blue-600 mt-0.5"></i>
          <div>
            <h4 className="font-medium text-blue-800">Dica</h4>
            <p className="text-sm text-blue-700">
              Após criar as cozinhas, vá em <strong>Configurações → Categorias</strong> para associar 
              cada categoria de produto a uma cozinha específica. Isso permitirá filtrar os produtos 
              no PDV e direcionar pedidos para a cozinha correta no KDS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

