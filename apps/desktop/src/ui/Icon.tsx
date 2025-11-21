import type { ComponentType } from 'react'
import {
  Search,
  Check,
  X,
  XCircle,
  Settings,
  RefreshCcw,
  Clock,
  LayoutGrid,
  ListChecks,
  WifiOff,
  ArrowLeft,
  Printer,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Save,
  Edit,
  CreditCard,
  DollarSign,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Square,
  UserPlus,
  CheckCheck,
  LogOut,
  LogIn,
  Lock,
  Unlock,
  AlertTriangle,
  Utensils,
} from 'lucide-react'

type IconName =
  | 'Search'
  | 'Check'
  | 'X'
  | 'Settings'
  | 'Refresh'
  | 'Clock'
  | 'LayoutGrid'
  | 'ListChecks'
  | 'WifiOff'
  | 'ArrowLeft'
  | 'Printer'
  | 'ShoppingCart'
  | 'Trash'
  | 'Plus'
  | 'Minus'
  | 'Save'
  | 'Edit'
  | 'CreditCard'
  | 'Cash'
  | 'FileText'
  | 'Calendar'
  | 'ChevronLeft'
  | 'ChevronRight'
  | 'Spinner'
  | 'XCircle'
  | 'UserPlus'
  | 'CheckDouble'
  | 'Square'
  | 'LogOut'
  | 'LogIn'
  | 'Lock'
  | 'Unlock'
  | 'Alert'
  | 'Utensils'

const MAP: Record<IconName, ComponentType<any>> = {
  Search,
  Check,
  X,
  Settings,
  Refresh: RefreshCcw,
  Clock,
  LayoutGrid,
  ListChecks,
  WifiOff,
  ArrowLeft,
  Printer,
  ShoppingCart,
  Trash: Trash2,
  Plus,
  Minus,
  Save,
  Edit,
  CreditCard,
  Cash: DollarSign,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Spinner: Loader2,
  XCircle,
  UserPlus,
  CheckDouble: CheckCheck,
  Square,
  LogOut,
  LogIn,
  Lock,
  Unlock,
  Alert: AlertTriangle,
  Utensils,
}

export interface IconProps {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

export function Icon({ name, size = 18, className, strokeWidth = 1.75 }: IconProps) {
  const Cmp = MAP[name] ?? Square
  if (name === 'Spinner') {
    return <Cmp size={size} strokeWidth={strokeWidth} className={`animate-spin ${className ?? ''}`} />
  }
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} />
}

export default Icon
