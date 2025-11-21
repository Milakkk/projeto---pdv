import Input from '../../../components/base/Input';
import Button from '../../../components/base/Button';

export default function UsersManager() {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <Input placeholder="Buscar usuários" />
        <Button>
          <i className="ri-user-add-line mr-2"></i>
          Novo usuário
        </Button>
      </div>
      <p className="text-sm text-gray-600">Tabela de usuários e CRUD serão implementados aqui.</p>
    </div>
  );
}
