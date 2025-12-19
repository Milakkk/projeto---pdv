import { runLoadTest, simulateIntermittentConnection, validateDataConsistency } from '@/utils/systemValidation'

export default function DevCaixa() {
  return (
    <div className="flex-1 flex items-center justify-center bg-white p-8">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Caixa (DEV)</h1>
          <p className="text-sm text-gray-600">Ferramentas de Validação e Estresse do Sistema</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => runLoadTest(20)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Teste de Carga (20 Pedidos)
          </button>
          
          <button 
            onClick={() => simulateIntermittentConnection(30000)}
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
          >
            Simular Conexão Intermitente
          </button>

          <button 
            onClick={() => validateDataConsistency()}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
          >
            Validar Consistência
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-4">Verifique os logs no console para resultados detalhados.</p>
      </div>
    </div>
  )
}

