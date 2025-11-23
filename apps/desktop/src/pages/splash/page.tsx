import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SplashPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => {
      navigate('/dashboard', { replace: true })
    }, 3000)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="flex flex-col items-center">
        <img src={'/vite.svg'} alt="Logo do Sistema" className="w-24 h-24 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">PDV-KDS</h1>
        <p className="text-sm text-gray-500 mt-2">Carregando...</p>
      </div>
    </div>
  )
}

