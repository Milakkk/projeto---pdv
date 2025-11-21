import React from 'react';
import Button from '../../../components/base/Button';

export default function RolesManager({ globalFilter }: { globalFilter: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Filtro: {globalFilter || '—'}</p>
        <Button size="sm" variant="primary">Novo perfil</Button>
      </div>
      <p className="text-sm text-gray-600">Configuração de perfis e permissões será integrada futuramente.</p>
    </div>
  );
}
