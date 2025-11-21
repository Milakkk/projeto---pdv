import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function RoleSelectPage() {
  const navigate = useNavigate()
  const { setPreferredModule, isAuthenticated } = useAuth()

  const choose = (path: string) => {
    setPreferredModule(path)
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-2xl border border-gray-200">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Selecione o Módulo</h1>
          <p className="text-sm text-gray-500">Escolha entre Caixa ou Cozinha</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => choose('/caixa')}
            className="w-full py-4 px-6 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition"
          >
            Caixa
          </button>
          <button
            onClick={() => choose('/cozinha')}
            className="w-full py-4 px-6 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
          >
            Cozinha
          </button>
        </div>
      </div>
    </div>
  )
}
