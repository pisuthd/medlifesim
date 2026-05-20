import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoadingScreen from './pages/LoadingScreen'
import ProfileSelector from './pages/ProfileSelector'
import MainLayout from './components/MainLayout'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Chat from './pages/Chat'
import Documents from './pages/Documents'
import Tools from './pages/Tools'

type ProfileType = 'self' | 'family' | 'doctor' | 'community'

interface Profile {
  id: string
  name: string
  type: ProfileType
  age?: number
  createdAt: Date
}

function App() {
  const [appState, setAppState] = useState<'loading' | 'profile' | 'main'>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])

  const handleLoadingComplete = () => {
    setAppState('profile')
  }

  const handleProfileSelect = (selectedProfile: Profile) => {
    setProfile(selectedProfile)
    setAppState('main')
  }

  const handleProfileCreate = (profileData: Omit<Profile, 'id' | 'createdAt'>) => {
    const newProfile: Profile = {
      ...profileData,
      id: Date.now().toString(),
      createdAt: new Date(),
    }
    setProfiles((prev) => [...prev, newProfile])
    setProfile(newProfile)
    setAppState('main')
  }

  if (appState === 'loading') {
    return <LoadingScreen onComplete={handleLoadingComplete} />
  }

  if (appState === 'profile' || !profile) {
    return <ProfileSelector profiles={profiles} onSelect={handleProfileSelect} onCreateProfile={handleProfileCreate} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout profile={profile} />}>
          <Route index element={<Dashboard />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="chat" element={<Chat />} />
          <Route path="documents" element={<Documents />} />
          <Route path="tools" element={<Tools />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App