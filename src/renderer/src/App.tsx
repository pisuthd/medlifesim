import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProfileProvider, Profile } from './context/ProfileContext'
import { AIProvider, useAI } from './context/AIContext'
import LoadingScreen from './pages/LoadingScreen'
import ModelSelector from './pages/ModelSelector'
import ProfileSelector from './pages/ProfileSelector'
import MainLayout from './components/MainLayout'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
import StartSimulation from './pages/StartSimulation'
import RecentSimulations from './pages/RecentSimulations'
import { MUTED, monoFont } from './theme'
import type { ModelEntry } from '../../preload/index.d'

type AppState = 'loading' | 'model' | 'model-loading' | 'profile' | 'main'

/**
 * Boot flow:
 *   loading        (brief splash)
 *   model          user picks a model in ModelSelector
 *   model-loading  LoadingScreen tracks the in-flight download/load
 *                  via useAI(); advances on its own when isReady
 *   profile        user picks / creates a profile
 *   main           HashRouter with Dashboard / Chat / Settings
 *
 * The model step is required because the chat needs a loaded model.
 * The model-loading step reuses the same LoadingScreen that already
 * reports real SDK progress (no more simulated polling).
 */
function App() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)

  // Brief splash so the wordmark fades in gracefully. ~250 ms.
  useEffect(() => {
    const t = setTimeout(() => setAppState('model'), 250)
    return () => clearTimeout(t)
  }, [])

  const handleLoadingComplete = () => {
    setAppState('profile')
  }

  const handleModelSelect = (_entry: ModelEntry) => {
    setAppState('model-loading')
  }

  const handleModelLoadingComplete = () => {
    setAppState('profile')
  }

  const handleModelSkip = () => {
    setAppState('profile')
  }

  const handleProfileSelect = (selectedProfile: Profile) => {
    setProfile(selectedProfile)
    setAppState('main')
  }

  const handleProfileCreate = async (
    profileData: { name: string; type: 'self' | 'family' | 'doctor' | 'community'; age?: number; gender?: 'male' | 'female' },
  ) => {
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
    <AIProvider>
      <HashRouter>
        {appState === 'loading' && <LoadingScreen onComplete={handleLoadingComplete} />}

        {appState === 'model' && <ModelSelectorGate onSelect={handleModelSelect} onSkip={handleModelSkip} />}

        {appState === 'model-loading' && <LoadingScreen onComplete={handleModelLoadingComplete} />}

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
                <Route path="start-simulation" element={<StartSimulation />} />
                <Route path="recent-simulations" element={<RecentSimulations />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ProfileProvider>
        )}
      </HashRouter>
    </AIProvider>
  )
}

/**
 * Wrapper that shows the model selector and forwards the user's pick to
 * the parent. If a model was already loaded (e.g. fast resume from cache),
 * it auto-advances without showing the selector at all.
 */
function ModelSelectorGate({
  onSelect,
  onSkip,
}: {
  onSelect: (entry: ModelEntry) => void
  onSkip: () => void
}) {
  const { isReady, status } = useAI()

  useEffect(() => {
    if (isReady && status?.active?.id) {
      const found = status.available.find((m) => m.id === status.active!.id)
      if (found) {
        onSelect(found)
      } else {
        onSkip()
      }
    }
  }, [isReady, status, onSelect, onSkip])

  return (
    <div style={{ position: 'relative' }}>
      <ModelSelector onComplete={onSelect} />
      {/* A small "skip" affordance for users who want to set up chat first
          and pick a model later from Settings. */}
      <button
        onClick={onSkip}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          background: 'transparent',
          border: 'none',
          color: MUTED,
          fontFamily: monoFont,
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Continue without loading →
      </button>
    </div>
  )
}

export default App
