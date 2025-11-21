"use client";

import { useMemo, useState } from "react";
import { useLocalStorage } from "../../../lib/useLocalStorage";
import Button from "../../../components/base/Button";
import Input from "../../../components/base/Input";

type Module = "CAIXA" | "COZINHA" | "GESTAO" | "MASTER" | "TAREFAS" | "CHECKLIST" | "PROCEDIMENTOS" | "RH";
type Role = { id: string; name: string; permissions: Module[] };

const allModules: Module[] = ["CAIXA","COZINHA","GESTAO","MASTER","TAREFAS","CHECKLIST","PROCEDIMENTOS","RH"];
const initialRoles: Role[] = [
  { id: "role_admin", name: "Administrador", permissions: allModules },
  { id: "role_gerente", name: "Gerente", permissions: ["GESTAO","CAIXA","COZINHA","CHECKLIST","RH"] },
];

export default function RolesManager() {
  const [roles, setRoles] = useLocalStorage<Role[]>("master_roles", initialRoles);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Role>>({});

  const filtered = useMemo(() => {
    if (!query.trim()) return roles;
    const q = query.toLowerCase();
    return roles.filter(r => r.name.toLowerCase().includes(q));
  }, [roles, query]);

  const startCreate = () => {
    setEditingId("new");
    setDraft({ id: "", name: "", permissions: [] });
  };
  const startEdit = (role: Role) => {
    setEditingId(role.id);
    setDraft({ ...role });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };
  const togglePermission = (perm: Module) => {
    setDraft(d => {
      const current = (d.permissions || []) as Module[];
      const has = current.includes(perm);
      const next = has ? current.filter(p => p !== perm) : [...current, perm];
      return { ...d, permissions: next };
    });
  };
  const saveDraft = () => {
    const name = (draft.name || "").trim();
    const permissions = (draft.permissions || []) as Module[];
    if (!name) {
      alert("Nome do perfil é obrigatório.");
      return;
    }
    if (editingId === "new") {
      const id = `role_${Date.now()}`;
      setRoles(prev => [...prev, { id, name, permissions }]);
    } else if (editingId) {
      setRoles(prev => prev.map(r => r.id === editingId ? { ...r, name, permissions } : r));
    }
    cancelEdit();
  };
  const removeRole = (id: string) => {
    if (!confirm("Excluir este perfil?")) return;
    setRoles(prev => prev.filter(r => r.id !== id));
  };

  return (
    <section className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Perfis de Acesso</h3>
        <div className="flex gap-2">
          <Input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome"
            className="text-sm"
          />
          <Button variant="primary" size="sm" onClick={startCreate}>
            <i className="ri-add-line mr-1"></i> Novo Perfil
          </Button>
        </div>
      </div>

      <div className="divide-y">
        {filtered.map(role => (
          <div key={role.id} className="py-3">
            {editingId === role.id ? (
              <div className="space-y-3">
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
                  <label className="block text-xs text-gray-500 mb-2">Permissões de Módulo</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {allModules.map(m => (
                      <label key={m} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(draft.permissions || []).includes(m)}
                          onChange={() => togglePermission(m)}
                        />
                        <span>{m}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={saveDraft}>
                    <i className="ri-save-2-line mr-1"></i> Salvar
                  </Button>
                  <Button size="sm" onClick={cancelEdit}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{role.name}</p>
                  <p className="text-sm text-gray-600">{role.permissions.join(', ') || 'Sem permissões'}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => startEdit(role)}>
                    <i className="ri-pencil-line mr-1"></i> Editar
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => removeRole(role.id)}>
                    <i className="ri-delete-bin-line mr-1"></i> Remover
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-500">Nenhum perfil encontrado.</div>
        )}
        {editingId === "new" && (
          <div className="py-3">
            <div className="space-y-3">
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
                <label className="block text-xs text-gray-500 mb-2">Permissões de Módulo</label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {allModules.map(m => (
                    <label key={m} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(draft.permissions || []).includes(m)}
                        onChange={() => togglePermission(m)}
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
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
