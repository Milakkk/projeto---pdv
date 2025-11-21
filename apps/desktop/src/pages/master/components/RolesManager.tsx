import Button from '../../../components/base/Button';

export default function RolesManager() {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Perfis</h3>
        <Button>
          <i className="ri-shield-user-line mr-2"></i>
          Novo perfil
        </Button>
      </div>
      <p className="text-sm text-gray-600">Configuração de perfis e permissões será implementada aqui.</p>
    </div>
  );
}
