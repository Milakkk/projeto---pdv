import React from 'react';
import Button from '../../../components/base/Button';

export default function StoresManager({ globalFilter }: { globalFilter: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Filtro: {globalFilter || '—'}</p>
        <Button size="sm" variant="primary">Nova loja</Button>
      </div>
      <p className="text-sm text-gray-600">Cadastro e gerenciamento de lojas serão adicionados futuramente.</p>
    </div>
  );
}
