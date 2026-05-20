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

export default function MainLayout({ profile }: { profile: Profile }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar profileName={profile.name} />
      <main style={{ flex: 1, background: '#f7f7fc' }}>
        <Outlet />
      </main>
    </div>
  )
}