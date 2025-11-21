"use client";
import { useState } from "react";
import StoresManager from "./components/StoresManager";
import RolesManager from "./components/RolesManager";
import UsersManager from "./components/UsersManager";

type Tab = "lojas" | "perfis" | "usuarios";

export default function ConfigMasterPage() {
  const [tab, setTab] = useState<Tab>("lojas");

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Configuração Master</h1>

      <div className="flex gap-2">
        <button
          className={`px-3 py-2 border rounded ${tab === "lojas" ? "bg-amber-100" : ""}`}
          onClick={() => setTab("lojas")}
        >
          Lojas
        </button>
        <button
          className={`px-3 py-2 border rounded ${tab === "perfis" ? "bg-amber-100" : ""}`}
          onClick={() => setTab("perfis")}
        >
          Perfis
        </button>
        <button
          className={`px-3 py-2 border rounded ${tab === "usuarios" ? "bg-amber-100" : ""}`}
          onClick={() => setTab("usuarios")}
        >
          Usuários
        </button>
      </div>

      {tab === "lojas" && <StoresManager />}
      {tab === "perfis" && <RolesManager />}
      {tab === "usuarios" && <UsersManager />}
    </div>
  );
}
