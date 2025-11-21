import Button from '../../../components/base/Button';

export default function StoresManager() {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Lojas</h3>
        <Button>
          <i className="ri-store-3-line mr-2"></i>
          Nova loja
        </Button>
      </div>
      <p className="text-sm text-gray-600">Gestão de lojas e configurações será implementada aqui.</p>
    </div>
  );
}
