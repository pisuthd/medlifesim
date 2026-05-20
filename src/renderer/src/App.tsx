import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoadingScreen from './pages/LoadingScreen'
import ProfileSelector from './pages/ProfileSelector'
import MainLayout from './components/MainLayout'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Chat from './pages/Chat'
import Documents from './pages/Documents'
import Tools from './pages/Tools'

interface Profile {
  id: string
  name: string
  type: 'self' | 'family' | 'doctor' | 'community'
  age?: number
  gender?: 'male' | 'female'
  createdAt: string
}

function App() {
  const [appState, setAppState] = useState<'loading' | 'profile' | 'main'>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false)

  useEffect(() => {
    // Only try to load profiles if API is available
    if (window.api?.profiles) {
      loadProfiles()
    } else {
      // If API not available, just go to profile selection
      setAppState('profile')
    }
  }, [])

  const loadProfiles = async () => {
    try {
      const loadedProfiles = await window.api.profiles.getAll()
      setProfiles(loadedProfiles)
    } catch (error) {
      console.error('Failed to load profiles:', error)
    } finally {
      setAppState('profile')
    }
  }

  const handleLoadingComplete = () => {
    setAppState('profile')
  }

  const handleProfileSelect = (selectedProfile: Profile) => {
    setProfile(selectedProfile)
    setAppState('main')
  }

  const handleProfileCreate = async (profileData: { name: string; type: 'self' | 'family' | 'doctor' | 'community'; age?: number; gender?: 'male' | 'female' }) => {
    setIsLoadingProfiles(true)
    try {
      // Check if API is available
      if (!window.api?.profiles) {
        console.error('API not available')
        // Fallback: create profile locally
        const localProfile: Profile = {
          ...profileData,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
        }
        setProfiles((prev) => [...prev, localProfile])
        setProfile(localProfile)
        setAppState('main')
        return
      }

      const newProfile = await window.api.profiles.add(profileData)
      setProfiles((prev) => [...prev, newProfile])
      setProfile(newProfile)
      setAppState('main')
    } catch (error) {
      console.error('Failed to create profile:', error)
      // Still go to main even if IPC fails - profile will be lost but app won't break
      const localProfile: Profile = {
        ...profileData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      setProfile(localProfile)
      setAppState('main')
    } finally {
      setIsLoadingProfiles(false)
    }
  }

  if (appState === 'loading') {
    return <LoadingScreen onComplete={handleLoadingComplete} />
  }

  if (appState === 'profile' || !profile) {
    return (
      <ProfileSelector 
        profiles={profiles} 
        onSelect={handleProfileSelect} 
        onCreateProfile={handleProfileCreate}
      />
    )
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