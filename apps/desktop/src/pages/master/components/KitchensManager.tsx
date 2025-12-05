import { useState, useEffect, useCallback } from 'react';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import { supabase } from '../../../utils/supabase';
import { testSupabaseKitchen } from '../../../utils/testSupabase';

interface Kitchen {
  id: string;
  name: string;
  is_active: number | boolean;
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
  const [error, setError] = useState<string | null>(null);

  // Verifica se está no Electron ou navegador
  const isElectron = typeof (window as any)?.api?.db?.query === 'function';

  const loadKitchens = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isElectron) {
        // Modo Electron - usa API local
        const api = (window as any)?.api;
        if (!api?.db?.query) {
          setError('API do Electron não disponível');
          return;
        }
        const result = await api.db.query('SELECT * FROM kitchens ORDER BY display_order, name');
        if (result?.rows) {
          setKitchens(result.rows);
        }
      } else {
        // Modo Navegador - usa Supabase
        if (!supabase) {
          setError('Supabase não configurado. Verifique as variáveis de ambiente.');
          return;
        }

        console.log('[KitchensManager] Carregando cozinhas do Supabase...');
        console.log('[KitchensManager] URL:', supabase.supabaseUrl);
        
        try {
          const { data, error: supabaseError } = await supabase
            .from('kitchens')
            .select('*')
            .order('display_order', { ascending: true })
            .order('name', { ascending: true });

          if (supabaseError) {
            console.error('[KitchensManager] Erro do Supabase:', supabaseError);
            console.error('[KitchensManager] Código:', supabaseError.code);
            console.error('[KitchensManager] Mensagem:', supabaseError.message);
            console.error('[KitchensManager] Detalhes:', supabaseError.details);
            console.error('[KitchensManager] Hint:', supabaseError.hint);
            setError(`Erro ao carregar: ${supabaseError.message} (${supabaseError.code || 'sem código'})`);
            throw supabaseError;
          }

          if (data) {
            // Mapeia do formato Supabase para o formato esperado
            const mapped = data.map(k => ({
              id: k.id,
              name: k.name,
              is_active: k.is_active ? 1 : 0, // Converte boolean para number
              display_order: k.display_order ?? 0,
              updated_at: k.updated_at,
            }));
            console.log('[KitchensManager] Cozinhas carregadas:', mapped.length);
            setKitchens(mapped);
          }
        } catch (fetchError: any) {
          // Erro de rede (CORS, conexão, etc)
          console.error('[KitchensManager] Erro de rede ao buscar cozinhas:', fetchError);
          console.error('[KitchensManager] Tipo:', fetchError?.name);
          console.error('[KitchensManager] Mensagem:', fetchError?.message);
          console.error('[KitchensManager] Stack:', fetchError?.stack);
          
          if (fetchError?.message?.includes('Failed to fetch') || fetchError?.name === 'TypeError') {
            setError('Erro de conexão com Supabase. Verifique: 1) URL está correta? 2) CORS habilitado? 3) Internet conectada?');
          } else {
            setError(`Erro: ${fetchError?.message || 'Erro desconhecido'}`);
          }
          throw fetchError;
        }
      }
    } catch (err: any) {
      console.error('[KitchensManager] Erro geral ao carregar cozinhas:', err);
      if (!error) { // Só atualiza se não tiver erro mais específico já definido
        setError(err?.message || 'Erro ao carregar cozinhas');
      }
    } finally {
      setLoading(false);
    }
  }, [isElectron]);

  useEffect(() => {
    loadKitchens();

    // Escutar mudanças em tempo real
    if (isElectron) {
      // Electron - escuta mudanças via IPC
      const api = (window as any)?.api;
      if (api?.db?.onChange) {
        const unsub = api.db.onChange((payload: any) => {
          if (payload?.table === 'kitchens') {
            loadKitchens();
          }
        });
        return () => unsub?.();
      }
    } else if (supabase) {
      // Navegador - escuta mudanças via Supabase Realtime
      // Desabilitado temporariamente para evitar erros de conexão
      // TODO: Reabilitar quando a conexão estiver estável
      /*
      try {
        const subscription = supabase
          .channel('kitchens-changes')
          .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'kitchens' },
            () => {
              console.log('[KitchensManager] Mudança detectada, recarregando...');
              loadKitchens();
            }
          )
          .subscribe((status) => {
            console.log('[KitchensManager] Status da subscription:', status);
            if (status === 'CHANNEL_ERROR') {
              console.error('[KitchensManager] Erro no canal Realtime');
            }
          });

        return () => {
          subscription.unsubscribe();
        };
      } catch (realtimeError) {
        console.warn('[KitchensManager] Erro ao configurar Realtime (não crítico):', realtimeError);
      }
      */
    }
  }, [loadKitchens, isElectron]);

  const handleCreate = async () => {
    if (!newKitchenName.trim()) return;

    try {
      setError(null);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const maxOrder = kitchens.reduce((max, k) => Math.max(max, k.display_order || 0), 0);

      if (isElectron) {
        // Modo Electron
        const api = (window as any)?.api;
        if (!api?.db?.query) {
          setError('API do Electron não disponível');
          return;
        }
        await api.db.query(
          `INSERT INTO kitchens (id, name, is_active, display_order, updated_at, version, pending_sync) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, newKitchenName.trim(), 1, maxOrder + 1, now, 1, 1]
        );
      } else {
        // Modo Navegador - Supabase
        if (!supabase) {
          setError('Supabase não configurado');
          return;
        }

        console.log('[KitchensManager] Criando cozinha no Supabase:', { id, name: newKitchenName.trim() });
        
        const { data, error: insertError } = await supabase
          .from('kitchens')
          .insert({
            id,
            name: newKitchenName.trim(),
            unit_id: null,
            is_active: true,
            display_order: maxOrder + 1,
            created_at: now,
            updated_at: now,
            version: 1,
            pending_sync: false,
          })
          .select();

        if (insertError) {
          console.error('[KitchensManager] Erro ao inserir:', insertError);
          setError(`Erro ao criar: ${insertError.message} (code: ${insertError.code})`);
          throw insertError;
        }

        console.log('[KitchensManager] Cozinha criada:', data);
      }

      setNewKitchenName('');
      setShowNewForm(false);
      await loadKitchens();
    } catch (err: any) {
      console.error('[KitchensManager] Erro ao criar cozinha:', err);
      setError(err?.message || 'Erro ao criar cozinha');
      alert(`Erro ao criar cozinha:\n\n${err?.message || String(err)}\n\nVerifique o console (F12) para mais detalhes.`);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;

    try {
      setError(null);
      const now = new Date().toISOString();

      if (isElectron) {
        const api = (window as any)?.api;
        if (!api?.db?.query) {
          setError('API do Electron não disponível');
          return;
        }
        await api.db.query(
          `UPDATE kitchens SET name = ?, updated_at = ?, pending_sync = 1 WHERE id = ?`,
          [editName.trim(), now, id]
        );
      } else {
        if (!supabase) {
          setError('Supabase não configurado');
          return;
        }
        const { error: updateError } = await supabase
          .from('kitchens')
          .update({ name: editName.trim(), updated_at: now })
          .eq('id', id);
        
        if (updateError) throw updateError;
      }

      setEditingId(null);
      setEditName('');
      await loadKitchens();
    } catch (err: any) {
      console.error('[KitchensManager] Erro ao atualizar cozinha:', err);
      setError(err?.message || 'Erro ao atualizar cozinha');
    }
  };

  const handleToggleActive = async (kitchen: Kitchen) => {
    try {
      setError(null);
      const now = new Date().toISOString();
      const currentStatus = typeof kitchen.is_active === 'boolean' ? kitchen.is_active : kitchen.is_active === 1;
      const newStatus = !currentStatus;

      if (isElectron) {
        const api = (window as any)?.api;
        if (!api?.db?.query) {
          setError('API do Electron não disponível');
          return;
        }
        await api.db.query(
          `UPDATE kitchens SET is_active = ?, updated_at = ?, pending_sync = 1 WHERE id = ?`,
          [newStatus ? 1 : 0, now, kitchen.id]
        );
      } else {
        if (!supabase) {
          setError('Supabase não configurado');
          return;
        }
        const { error: updateError } = await supabase
          .from('kitchens')
          .update({ is_active: newStatus, updated_at: now })
          .eq('id', kitchen.id);
        
        if (updateError) throw updateError;
      }

      await loadKitchens();
    } catch (err: any) {
      console.error('[KitchensManager] Erro ao alterar status:', err);
      setError(err?.message || 'Erro ao alterar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta cozinha?')) return;

    try {
      setError(null);

      if (isElectron) {
        // Modo Electron
        const api = (window as any)?.api;
        if (!api?.db?.query) {
          setError('API do Electron não disponível');
          return;
        }
        await api.db.query('UPDATE categories SET kitchen_id = NULL WHERE kitchen_id = ?', [id]);
        await api.db.query('DELETE FROM kitchens WHERE id = ?', [id]);
      } else {
        // Modo Navegador - Supabase
        if (!supabase) {
          setError('Supabase não configurado');
          return;
        }

        console.log('[KitchensManager] Deletando cozinha do Supabase:', id);
        
        // Primeiro remove associações (se houver tabela category_kitchens)
        const { error: deleteError } = await supabase
          .from('kitchens')
          .delete()
          .eq('id', id);

        if (deleteError) {
          console.error('[KitchensManager] Erro ao deletar:', deleteError);
          setError(`Erro ao deletar: ${deleteError.message}`);
          throw deleteError;
        }

        console.log('[KitchensManager] Cozinha deletada com sucesso');
      }

      await loadKitchens();
    } catch (err: any) {
      console.error('[KitchensManager] Erro ao excluir cozinha:', err);
      setError(err?.message || 'Erro ao excluir cozinha');
      alert(`Erro ao excluir cozinha:\n\n${err?.message || String(err)}`);
    }
  };

  const handleMoveOrder = async (kitchen: Kitchen, direction: 'up' | 'down') => {
    const currentIndex = kitchens.findIndex(k => k.id === kitchen.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= kitchens.length) return;

    const targetKitchen = kitchens[targetIndex];
    const now = new Date().toISOString();

    try {
      setError(null);

      if (isElectron) {
        const api = (window as any)?.api;
        if (!api?.db?.query) {
          setError('API do Electron não disponível');
          return;
        }
        await api.db.query(
          'UPDATE kitchens SET display_order = ?, updated_at = ? WHERE id = ?',
          [targetKitchen.display_order, now, kitchen.id]
        );
        await api.db.query(
          'UPDATE kitchens SET display_order = ?, updated_at = ? WHERE id = ?',
          [kitchen.display_order, now, targetKitchen.id]
        );
      } else {
        if (!supabase) {
          setError('Supabase não configurado');
          return;
        }
        // Atualiza ambas as cozinhas
        const { error: error1 } = await supabase
          .from('kitchens')
          .update({ display_order: targetKitchen.display_order, updated_at: now })
          .eq('id', kitchen.id);
        
        if (error1) throw error1;

        const { error: error2 } = await supabase
          .from('kitchens')
          .update({ display_order: kitchen.display_order, updated_at: now })
          .eq('id', targetKitchen.id);
        
        if (error2) throw error2;
      }

      await loadKitchens();
    } catch (err: any) {
      console.error('[KitchensManager] Erro ao reordenar:', err);
      setError(err?.message || 'Erro ao reordenar');
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
      {/* Indicador de Erro */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <i className="ri-error-warning-line text-red-600 text-xl mr-2"></i>
            <div>
              <h3 className="font-medium text-red-800">Erro</h3>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de Modo e Botão de Teste */}
      {import.meta.env.DEV && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-blue-700">
              <strong>Modo:</strong> {isElectron ? 'Electron (DB Local)' : 'Navegador (Supabase)'}
              {!isElectron && !supabase && ' ⚠️ Supabase não configurado!'}
              {!isElectron && supabase && ' ✅ Supabase conectado'}
            </div>
            {!isElectron && (
              <Button 
                size="sm" 
                variant="secondary"
                onClick={async () => {
                  console.log('🧪 Iniciando teste do Supabase...');
                  await testSupabaseKitchen();
                }}
              >
                <i className="ri-bug-line mr-1"></i>
                Testar Supabase
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Gerenciar Cozinhas</h3>
          <p className="text-sm text-gray-600">
            Configure as cozinhas disponíveis. Cada cozinha pode ter categorias de produtos associadas.
          </p>
        </div>
        <Button onClick={() => setShowNewForm(true)} disabled={loading}>
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

