import React from 'react';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';

export default function UsersManager({ globalFilter }: { globalFilter: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Input value={globalFilter} readOnly placeholder="Filtro aplicado" />
        <Button size="sm" variant="primary">Novo usuário</Button>
      </div>
      <p className="text-sm text-gray-600">Tabela e CRUD de usuários serão conectados futuramente.</p>
    </div>
  );
}
