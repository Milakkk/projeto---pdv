"use client";

import { useMemo, useState } from "react";
import { useLocalStorage } from "../../../lib/useLocalStorage";
import Button from "../../../components/base/Button";
import Input from "../../../components/base/Input";

type Store = { id: string; name: string };
type Role = { id: string; name: string };
type HrPerson = { id: string; name: string; status?: "ativo" | "inativo"; storeId?: string };
type User = { id: string; email: string; username: string; name: string; passwordHash: string; storeId?: string; storeIds?: string[]; roleId: string; linkedPersonId?: string };

const initialStores: Store[] = [
  { id: "store_1", name: "Loja Centro" },
  { id: "store_2", name: "Loja Norte" },
];
const initialRoles: Role[] = [
  { id: "role_admin", name: "Administrador" },
  { id: "role_gerente", name: "Gerente" },
];
const initialUsers: User[] = [];

export default function UsersManager() {
  const [users, setUsers] = useLocalStorage<User[]>("master_users", initialUsers);
  const [stores] = useLocalStorage<Store[]>("master_stores", initialStores);
  const [roles] = useLocalStorage<Role[]>("master_roles", initialRoles);
  const [hrPeople] = useLocalStorage<HrPerson[]>("rh_people", []);

  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<User>>({});

  const getDisplayName = (u: User) => {
    if (u.linkedPersonId) {
      const p = hrPeople.find(p => p.id === u.linkedPersonId);
      if (p) return p.name;
    }
    return u.name;
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.toLowerCase();
    return users.filter(u => getDisplayName(u).toLowerCase().includes(q));
  }, [users, query, hrPeople]);

  const getStoreName = (id?: string) => (id ? (stores.find(s => s.id === id)?.name || "—") : "—");
  const getRoleName = (id: string) => roles.find(r => r.id === id)?.name || "—";

  const startCreate = () => {
    setEditingId("new");
    setDraft({ id: "", name: "", email: "", passwordHash: "", storeIds: stores[0]?.id ? [stores[0].id] : [], roleId: roles[0]?.id, linkedPersonId: "" as any });
  };
  const startEdit = (user: User) => {
    setEditingId(user.id);
    setDraft({ ...user });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveDraft = () => {
    const email = (draft.email || "").trim();
    const passwordHash = (draft.passwordHash || "").trim();
    const roleId = draft.roleId || "";
    const storeIds = (draft.storeIds || []).filter(Boolean);
    const linkedPersonId = (draft as any).linkedPersonId as string | undefined;

    if (!linkedPersonId) {
      alert("Selecione um empregado ATIVO de RH para vincular.");
      return;
    }
    const person = hrPeople.find(p => p.id === linkedPersonId);
    if (!person || person.status !== "ativo") {
      alert("A pessoa selecionada não está ATIVA.");
      return;
    }
    if (!email || !passwordHash || !roleId) {
      alert("Preencha e-mail, senha e perfil.");
      return;
    }

    const primaryStoreId = person.storeId;

    if (editingId === "new") {
      const id = `user_${Date.now()}`;
      setUsers(prev => [...prev, { id, email, username: email, name: person.name, passwordHash, storeId: primaryStoreId, storeIds: primaryStoreId ? [primaryStoreId] : storeIds, roleId, linkedPersonId: person.id }]);
      cancelEdit();
      return;
    }

    if (editingId) {
      const nextStoreIds = storeIds.length ? storeIds : (primaryStoreId ? [primaryStoreId] : []);
      setUsers(prev => prev.map(u => u.id === editingId ? { ...u, email, username: email, name: person.name, passwordHash, storeId: primaryStoreId, storeIds: nextStoreIds, roleId, linkedPersonId: person.id } : u));
    }
    cancelEdit();
  };

  const removeUser = (id: string) => {
    if (!confirm("Excluir este usuário?")) return;
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  return (
    <section className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Usuários</h3>
        <div className="flex gap-2">
          <Input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome"
            className="text-sm"
          />
          <Button variant="primary" size="sm" onClick={startCreate}>
            <i className="ri-add-line mr-1"></i> Novo Usuário
          </Button>
        </div>
      </div>

      <div className="divide-y">
        {filtered.map(user => (
          <div key={user.id} className="py-3">
            {editingId === user.id ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Empregado (RH • somente ATIVO)</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={(draft as any).linkedPersonId || ""}
                    onChange={e => setDraft(d => ({ ...d, linkedPersonId: e.target.value } as any))}
                  >
                    <option value="">Selecione</option>
                    {hrPeople.filter(p => p.status === "ativo").map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">E-mail</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={draft.email || ""}
                    onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Senha</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={draft.passwordHash || ""}
                    onChange={e => setDraft(d => ({ ...d, passwordHash: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lojas</label>
                  <div className="border rounded-md p-2 max-h-40 overflow-auto">
                    {stores.map(s => {
                      const checked = (draft.storeIds || []).includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-2 text-sm py-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setDraft(d => {
                                const current = new Set(d.storeIds || []);
                                if (e.target.checked) current.add(s.id);
                                else current.delete(s.id);
                                return { ...d, storeIds: Array.from(current) };
                              });
                            }}
                          />
                          <span>{s.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Perfil</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={draft.roleId || roles[0]?.id || ""}
                    onChange={e => setDraft(d => ({ ...d, roleId: e.target.value }))}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
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
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{getDisplayName(user)} {user.linkedPersonId && hrPeople.find(p => p.id === user.linkedPersonId && p.status !== "ativo") ? (<span className="ml-2 text-xs text-red-600">(Pessoa INATIVA)</span>) : null}</p>
                  <p className="text-sm text-gray-600">Lojas: {user.storeIds && user.storeIds.length ? user.storeIds.map(id => getStoreName(id)).join(', ') : getStoreName(user.storeId)} | Perfil: {getRoleName(user.roleId)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => startEdit(user)}>
                    <i className="ri-pencil-line mr-1"></i> Editar
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => removeUser(user.id)}>
                    <i className="ri-delete-bin-line mr-1"></i> Remover
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-500">Nenhum usuário encontrado.</div>
        )}
        {editingId === "new" && (
          <div className="py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Empregado (RH • somente ATIVO)</label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={(draft as any).linkedPersonId || ""}
                  onChange={e => setDraft(d => ({ ...d, linkedPersonId: e.target.value } as any))}
                >
                  <option value="">Selecione</option>
                  {hrPeople.filter(p => p.status === "ativo").map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {hrPeople.filter(p => p.status === "ativo").length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">Cadastre um empregado ATIVO em RH para criar usuários.</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">E-mail</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={draft.email || ""}
                  onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Senha</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={draft.passwordHash || ""}
                  onChange={e => setDraft(d => ({ ...d, passwordHash: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Lojas</label>
                <div className="border rounded-md p-2 max-h-40 overflow-auto">
                  {stores.map(s => {
                    const checked = (draft.storeIds || []).includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-sm py-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setDraft(d => {
                              const current = new Set(d.storeIds || []);
                              if (e.target.checked) current.add(s.id);
                              else current.delete(s.id);
                              return { ...d, storeIds: Array.from(current) };
                            });
                          }}
                        />
                        <span>{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Perfil</label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={draft.roleId || roles[0]?.id || ""}
                  onChange={e => setDraft(d => ({ ...d, roleId: e.target.value }))}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
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
