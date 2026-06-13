import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

interface Profile {
  id: string
  name: string
  type: 'self' | 'family' | 'doctor' | 'community'
  age?: number
  gender?: 'male' | 'female'
  createdAt: string
}

export default function MainLayout(_: { profile: Profile }) {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ 
        flex: 1, 
        background: '#f7f7fc',
        marginLeft: 200,
        minHeight: '100vh',
        boxSizing: 'border-box'
      }}>
        <Outlet />
      </main>
    </div>
  )
}