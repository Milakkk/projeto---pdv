"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "../../components/base/Button";
import Input from "../../components/base/Input";
import { useLocalStorage } from "../../lib/useLocalStorage";

// usando hook compartilhado de localStorage

// Tipos mínimos para RH
type Store = { id: string; name: string; address?: string; city?: string; cnpj?: string };
type HrPerson = { id: string; name: string; email?: string; phone?: string; storeId?: string; status?: "ativo" | "inativo" };
type HrSchedule = { id: string; personId: string; date: string; start: string; end: string; storeId?: string };
type HrMonthlySchedule = { id: string; month: string; storeId?: string; notes?: string };
type HrConfig = { defaultStoreId?: string; workdayStart?: string; workdayEnd?: string };

// Dados iniciais para facilitar visualização
const initialStores: Store[] = [
  { id: "store_1", name: "Loja Centro", address: "Rua A, 123", city: "São Paulo", cnpj: "00.000.000/0001-00" },
  { id: "store_2", name: "Loja Norte", address: "Av. B, 456", city: "São Paulo", cnpj: "11.111.111/0001-11" },
];
const initialPeople: HrPerson[] = [
  { id: "p_1", name: "Ana Silva", email: "ana@exemplo.com", phone: "(11) 99999-1111", storeId: "store_1", status: "ativo" },
  { id: "p_2", name: "Bruno Souza", email: "bruno@exemplo.com", phone: "(11) 99999-2222", storeId: "store_2", status: "ativo" },
];
const initialSchedules: HrSchedule[] = [];
const initialMonthly: HrMonthlySchedule[] = [];
const initialConfig: HrConfig = { workdayStart: "08:00", workdayEnd: "18:00", defaultStoreId: "store_1" };

export default function RHPage() {
  // Estado geral (espelhando referencia/rh/page.tsx)
  const [tab, setTab] = useState<"pessoas" | "escala" | "config">("pessoas");
  const [stores, setStores] = useLocalStorage<Store[]>("master_stores", initialStores);
  const [people, setPeople] = useLocalStorage<HrPerson[]>("rh_people", initialPeople);
  const [schedules, setSchedules] = useLocalStorage<HrSchedule[]>("rh_schedules", initialSchedules);
  const [monthlySchedules, setMonthlySchedules] = useLocalStorage<HrMonthlySchedule[]>("rh_monthly", initialMonthly);
  const [config, setConfig] = useLocalStorage<HrConfig>("rh_config", initialConfig);

  // Filtros pessoas
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("todos");
  const [storeFilter, setStoreFilter] = useState<string>("todas");

  // Draft para criação/edição de pessoa
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<HrPerson>>({});

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter(p => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q) || (p.phone || "").toLowerCase().includes(q);
      const matchesStatus = status === "todos" || p.status === status;
      const matchesStore = storeFilter === "todas" || p.storeId === storeFilter;
      return matchesQuery && matchesStatus && matchesStore;
    });
  }, [people, query, status, storeFilter]);

  const startCreatePerson = () => {
    setEditingId("new");
    setDraft({ name: "", email: "", phone: "", storeId: config.defaultStoreId, status: "ativo" });
  };
  const startEditPerson = (p: HrPerson) => {
    setEditingId(p.id);
    setDraft({ ...p });
  };
  const cancelEditPerson = () => {
    setEditingId(null);
    setDraft({});
  };
  const savePerson = () => {
    const name = (draft.name || "").trim();
    if (!name) {
      alert("Nome é obrigatório.");
      return;
    }
    if (editingId === "new") {
      const id = `p_${Date.now()}`;
      setPeople(prev => [...prev, { id, name, email: draft.email || "", phone: draft.phone || "", storeId: draft.storeId, status: (draft.status as any) || "ativo" }]);
    } else if (editingId) {
      setPeople(prev => prev.map(p => p.id === editingId ? { ...p, name: name, email: draft.email || "", phone: draft.phone || "", storeId: draft.storeId, status: (draft.status as any) || "ativo" } : p));
    }
    cancelEditPerson();
  };
  const removePerson = (id: string) => {
    if (!confirm("Excluir esta pessoa?")) return;
    setPeople(prev => prev.filter(p => p.id !== id));
    setSchedules(prev => prev.filter(s => s.personId !== id));
  };

  // Escala simples semanal
  const [weekStart, setWeekStart] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay(); // 0-6
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // segunda-feira
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().substring(0, 10);
  });
  const [escalaStore, setEscalaStore] = useState<string>("todas");

  const weekDays = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().substring(0, 10);
    });
  }, [weekStart]);

  const addSchedule = (personId: string, date: string) => {
    const start = config.workdayStart || "08:00";
    const end = config.workdayEnd || "18:00";
    const id = `sch_${Date.now()}`;
    const person = people.find(p => p.id === personId);
    setSchedules(prev => [...prev, { id, personId, date, start, end, storeId: person?.storeId }]);
  };
  const removeSchedule = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const schedulesByDay = useMemo(() => {
    const filtered = schedules.filter(s => (escalaStore === "todas" || s.storeId === escalaStore) && weekDays.includes(s.date));
    const map: Record<string, HrSchedule[]> = {};
    weekDays.forEach(d => { map[d] = []; });
    filtered.forEach(s => { (map[s.date] ||= []).push(s); });
    return map;
  }, [schedules, weekDays, escalaStore]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recursos Humanos</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/" className="px-3 py-2 border rounded-md">Início</Link>
          <Link href="/configuracao-master" className="px-3 py-2 border rounded-md">Master</Link>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <Button variant={tab === "pessoas" ? "primary" : undefined} onClick={() => setTab("pessoas")}>Pessoas</Button>
        <Button variant={tab === "escala" ? "primary" : undefined} onClick={() => setTab("escala")}>Escala</Button>
        <Button variant={tab === "config" ? "primary" : undefined} onClick={() => setTab("config")}>Configurações</Button>
      </div>

      {tab === "pessoas" && (
        <section className="bg-white rounded-lg shadow border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Pessoas</h2>
            <div className="flex gap-2">
              <Input className="text-sm" placeholder="Buscar por nome/email" value={query} onChange={e => setQuery(e.target.value)} />
              <select className="px-3 py-2 border rounded-md text-sm" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
              <select className="px-3 py-2 border rounded-md text-sm" value={storeFilter} onChange={e => setStoreFilter(e.target.value)}>
                <option value="todas">Todas Lojas</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button variant="primary" size="sm" onClick={startCreatePerson}><i className="ri-add-line mr-1" /> Nova Pessoa</Button>
            </div>
          </div>
          <div className="divide-y">
            {filteredPeople.map(p => (
              <div key={p.id} className="py-3 flex items-start justify-between">
                {editingId === p.id ? (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nome</label>
                      <Input className="w-full text-sm" value={draft.name || ""} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Email</label>
                      <Input className="w-full text-sm" value={draft.email || ""} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Telefone</label>
                      <Input className="w-full text-sm" value={draft.phone || ""} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Loja</label>
                      <select className="w-full px-3 py-2 border rounded-md text-sm" value={draft.storeId || ""} onChange={e => setDraft(d => ({ ...d, storeId: e.target.value }))}>
                        <option value="">Selecione</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Status</label>
                      <select className="w-full px-3 py-2 border rounded-md text-sm" value={draft.status || "ativo"} onChange={e => setDraft(d => ({ ...d, status: e.target.value as any }))}>
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </div>
                    <div className="col-span-1 md:col-span-2 flex gap-2 mt-1">
                      <Button variant="primary" size="sm" onClick={savePerson}><i className="ri-save-2-line mr-1" /> Salvar</Button>
                      <Button size="sm" onClick={cancelEditPerson}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-sm text-gray-600">{p.email || "—"} · {p.phone || "—"}</p>
                    <p className="text-xs text-gray-500">Loja: {stores.find(s => s.id === p.storeId)?.name || "—"} · Status: {p.status}</p>
                  </div>
                )}
                {editingId === p.id ? null : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => startEditPerson(p)}><i className="ri-pencil-line mr-1" /> Editar</Button>
                    <Button variant="danger" size="sm" onClick={() => removePerson(p.id)}><i className="ri-delete-bin-line mr-1" /> Remover</Button>
                  </div>
                )}
              </div>
            ))}
            {filteredPeople.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-500">Nenhuma pessoa encontrada.</div>
            )}
            {editingId === "new" && (
              <div className="py-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nome</label>
                    <Input className="w-full text-sm" value={draft.name || ""} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Email</label>
                    <input className="w-full px-3 py-2 border rounded-md text-sm" value={draft.email || ""} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Telefone</label>
                    <input className="w-full px-3 py-2 border rounded-md text-sm" value={draft.phone || ""} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Loja</label>
                    <select className="w-full px-3 py-2 border rounded-md text-sm" value={draft.storeId || ""} onChange={e => setDraft(d => ({ ...d, storeId: e.target.value }))}>
                      <option value="">Selecione</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Status</label>
                    <select className="w-full px-3 py-2 border rounded-md text-sm" value={draft.status || "ativo"} onChange={e => setDraft(d => ({ ...d, status: e.target.value as any }))}>
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                  <div className="col-span-1 md:col-span-2 flex gap-2 mt-1">
                    <button className="px-3 py-2 border rounded-md bg-gray-900 text-white text-sm" onClick={savePerson}><i className="ri-save-2-line mr-1" /> Criar</button>
                    <button className="px-3 py-2 border rounded-md text-sm" onClick={cancelEditPerson}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "escala" && (
        <section className="bg-white rounded-lg shadow border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Escala Semanal</h2>
            <div className="flex gap-2">
              <input type="date" className="px-3 py-2 border rounded-md text-sm" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
              <select className="px-3 py-2 border rounded-md text-sm" value={escalaStore} onChange={e => setEscalaStore(e.target.value)}>
                <option value="todas">Todas Lojas</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {weekDays.map(d => (
              <div key={d} className="border rounded-md">
                <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium">{new Date(d).toLocaleDateString()}</div>
                <div className="p-2 space-y-2">
                  {schedulesByDay[d]?.map(s => (
                    <div key={s.id} className="p-2 border rounded-md flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{people.find(p => p.id === s.personId)?.name || s.personId}</div>
                        <div className="text-xs text-gray-500">{s.start}–{s.end}</div>
                      </div>
                      <button className="px-2 py-1 border rounded-md text-xs" onClick={() => removeSchedule(s.id)}>Remover</button>
                    </div>
                  ))}
                  <div>
                    <select className="w-full px-2 py-1 border rounded-md text-sm" onChange={e => { const pid = e.target.value; if (pid) { addSchedule(pid, d); e.currentTarget.selectedIndex = 0; } }}>
                      <option value="">Adicionar pessoa…</option>
                      {people.filter(p => escalaStore === "todas" || p.storeId === escalaStore).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "config" && (
        <section className="bg-white rounded-lg shadow border p-4">
          <h2 className="text-lg font-semibold mb-3">Configurações de RH</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Loja padrão</label>
              <select className="w-full px-3 py-2 border rounded-md text-sm" value={config.defaultStoreId || ""} onChange={e => setConfig(c => ({ ...c, defaultStoreId: e.target.value }))}>
                <option value="">Selecione</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Início do expediente</label>
              <input type="time" className="w-full px-3 py-2 border rounded-md text-sm" value={config.workdayStart || ""} onChange={e => setConfig(c => ({ ...c, workdayStart: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fim do expediente</label>
              <input type="time" className="w-full px-3 py-2 border rounded-md text-sm" value={config.workdayEnd || ""} onChange={e => setConfig(c => ({ ...c, workdayEnd: e.target.value }))} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
