import { useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProfileProvider, Profile } from './context/ProfileContext'
import LoadingScreen from './pages/LoadingScreen'
import ProfileSelector from './pages/ProfileSelector'
import MainLayout from './components/MainLayout'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Chat from './pages/Chat'
import Documents from './pages/Documents'
import Settings from './pages/Settings'
import Tools from './pages/Tools'

function App() {
  const [appState, setAppState] = useState<'loading' | 'profile' | 'main'>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)

  const handleLoadingComplete = () => {
    setAppState('profile')
  }

  const handleProfileSelect = (selectedProfile: Profile) => {
    setProfile(selectedProfile)
    setAppState('main')
  }

  const handleProfileCreate = async (profileData: { name: string; type: 'self' | 'family' | 'doctor' | 'community'; age?: number; gender?: 'male' | 'female' }) => {
    try {
      if (!window.api?.profiles) {
        const localProfile: Profile = {
          ...profileData,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
        }
        setProfile(localProfile)
        setAppState('main')
        return
      }

      const newProfile = await window.api.profiles.add(profileData)
      setProfile(newProfile)
      setAppState('main')
    } catch (error) {
      console.error('Failed to create profile:', error)
      const localProfile: Profile = {
        ...profileData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      setProfile(localProfile)
      setAppState('main')
    }
  }

  return (
    <HashRouter>
      {appState === 'loading' && <LoadingScreen onComplete={handleLoadingComplete} />}
      
      {appState === 'profile' && !profile && (
        <ProfileSelector 
          onSelect={handleProfileSelect} 
          onCreateProfile={handleProfileCreate}
        />
      )}
      
      {appState === 'main' && profile && (
        <ProfileProvider initialProfile={profile}>
          <Routes>
            <Route path="/" element={<MainLayout profile={profile} />}>
              <Route index element={<Dashboard />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="chat" element={<Chat />} />
              <Route path="documents" element={<Documents />} />
              <Route path="settings" element={<Settings />} />
              <Route path="tools" element={<Tools />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProfileProvider>
      )}
    </HashRouter>
  )
}

export default App