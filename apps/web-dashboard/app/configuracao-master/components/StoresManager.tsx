"use client";

import { useMemo, useState } from "react";
import { useLocalStorage } from "../../../lib/useLocalStorage";
import Button from "../../../components/base/Button";
import Input from "../../../components/base/Input";

type Store = { id: string; name: string; address?: string; city?: string; cnpj?: string };
const initialStores: Store[] = [
  { id: "store_1", name: "Loja Centro", address: "Rua A, 123", city: "São Paulo", cnpj: "00.000.000/0001-00" },
  { id: "store_2", name: "Loja Norte", address: "Av. B, 456", city: "São Paulo", cnpj: "11.111.111/0001-11" },
];

export default function StoresManager() {
  const [stores, setStores] = useLocalStorage<Store[]>("master_stores", initialStores);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Store>>({});

  const filtered = useMemo(() => {
    if (!query.trim()) return stores;
    const q = query.toLowerCase();
    return stores.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.address || "").toLowerCase().includes(q) ||
      (s.city || "").toLowerCase().includes(q) ||
      (s.cnpj || "").toLowerCase().includes(q)
    );
  }, [stores, query]);

  const startCreate = () => {
    setEditingId("new");
    setDraft({ id: "", name: "", address: "" });
  };

  const startEdit = (store: Store) => {
    setEditingId(store.id);
    setDraft({ ...store });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveDraft = () => {
    const name = (draft.name || "").trim();
    const address = (draft.address || "").trim();
    const city = (draft.city || "").trim();
    const cnpj = (draft.cnpj || "").trim();
    if (!name) {
      alert("Nome da loja é obrigatório.");
      return;
    }
    if (editingId === "new") {
      const id = `store_${Date.now()}`;
      setStores(prev => [...prev, { id, name, address, city, cnpj }]);
    } else if (editingId) {
      setStores(prev => prev.map(s => s.id === editingId ? { ...s, name, address, city, cnpj } : s));
    }
    cancelEdit();
  };

  const removeStore = (id: string) => {
    if (!confirm("Excluir esta loja?")) return;
    setStores(prev => prev.filter(s => s.id !== id));
  };

  return (
    <section className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Lojas</h3>
        <div className="flex gap-2">
          <Input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome/endereço"
            className="text-sm"
          />
          <Button variant="primary" size="sm" onClick={startCreate}>
            <i className="ri-add-line mr-1"></i> Nova Loja
          </Button>
        </div>
      </div>

      <div className="divide-y">
        {filtered.map(store => (
          <div key={store.id} className="py-3 flex items-start justify-between">
            {editingId === store.id ? (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nome</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={draft.name || ""}
                    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Endereço</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={draft.address || ""}
                    onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cidade</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={draft.city || ""}
                    onChange={e => setDraft(d => ({ ...d, city: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">CNPJ</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={draft.cnpj || ""}
                    onChange={e => setDraft(d => ({ ...d, cnpj: e.target.value }))}
                  />
                </div>
                <div className="col-span-1 md:col-span-2 flex gap-2 mt-1">
                  <Button variant="primary" size="sm" onClick={saveDraft}>
                    <i className="ri-save-2-line mr-1"></i> Salvar
                  </Button>
                  <Button size="sm" onClick={cancelEdit}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1">
                <p className="font-medium text-gray-900">{store.name}</p>
                <p className="text-sm text-gray-600">{store.address || "—"}</p>
                <p className="text-xs text-gray-500">Cidade: {store.city || "—"} | CNPJ: {store.cnpj || "—"}</p>
              </div>
            )}
            {editingId === store.id ? null : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => startEdit(store)}>
                  <i className="ri-pencil-line mr-1"></i> Editar
                </Button>
                <Button variant="danger" size="sm" onClick={() => removeStore(store.id)}>
                  <i className="ri-delete-bin-line mr-1"></i> Remover
                </Button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-500">Nenhuma loja encontrada.</div>
        )}
        {editingId === "new" && (
          <div className="py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nome</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={draft.name || ""}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Endereço</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={draft.address || ""}
                  onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cidade</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={draft.city || ""}
                  onChange={e => setDraft(d => ({ ...d, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">CNPJ</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={draft.cnpj || ""}
                  onChange={e => setDraft(d => ({ ...d, cnpj: e.target.value }))}
                />
              </div>
              <div className="col-span-1 md:col-span-2 flex gap-2 mt-1">
                <Button variant="primary" size="sm" onClick={saveDraft}>
                  <i className="ri-save-2-line mr-1"></i> Criar
                </Button>
                <Button size="sm" onClick={cancelEdit}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
