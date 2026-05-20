import { motion } from 'framer-motion'
import { useState } from 'react'

type ProfileType = 'self' | 'family' | 'doctor' | 'community'

interface Profile {
  id: string
  name: string
  type: ProfileType
  age?: number
  gender?: 'male' | 'female'
  createdAt: Date
}

interface ProfileSelectorProps {
  profiles: Profile[]
  onSelect: (profile: Profile) => void
  onCreateProfile: (profileData: Omit<Profile, 'id' | 'createdAt'>) => void
}

function CreateProfileForm({ onComplete, onBack }: { 
  onComplete: (profile: Omit<Profile, 'id' | 'createdAt'>) => void
  onBack: () => void 
}) {
  const [step, setStep] = useState<'type' | 'details'>('type')
  const [profileType, setProfileType] = useState<ProfileType | null>(null)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')

  const profileTypes = [
    { id: 'self', label: 'Check symptoms for yourself' },
    { id: 'family', label: 'Check symptoms for family member' },
    { id: 'doctor', label: 'You are a doctor' },
    { id: 'community', label: 'You are a community leader' },
  ]

  const handleTypeSelect = (type: ProfileType) => {
    setProfileType(type)
    setStep('details')
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    onComplete({
      name,
      type: profileType!,
      age: profileType === 'self' ? (parseInt(age) || undefined) : undefined,
      gender: profileType === 'self' ? (gender || undefined) : undefined,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {step === 'type' ? (
        <>
          <button onClick={onBack} className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1">
            ← Back
          </button>
          <h2 className="text-xl font-semibold text-gray-800">Who are you checking symptoms for?</h2>
          <div className="space-y-3">
            {profileTypes.map((type, index) => (
              <motion.button
                key={type.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleTypeSelect(type.id as ProfileType)}
                className="w-full p-4 text-left bg-gray-50 hover:bg-primary-50 rounded-xl border-2 border-transparent hover:border-primary-400 transition-all flex items-center gap-4"
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium">
                  {index + 1}
                </div>
                <span className="text-gray-700 font-medium">{type.label}</span>
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setStep('type')} className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1">
            ← Back
          </button>
          <h2 className="text-xl font-semibold text-gray-800">Create Profile</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Enter name"
            />
          </div>

          {profileType === 'self' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Enter age"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`flex-1 py-2 rounded-lg border-2 transition-all ${
                      gender === 'male' 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`flex-1 py-2 rounded-lg border-2 transition-all ${
                      gender === 'female' 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Female
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            onClick={handleSubmit}
            disabled={!name.trim() || (profileType === 'self' && !gender)}
            className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Profile
          </button>
        </>
      )}
    </motion.div>
  )
}

export default function ProfileSelector({ profiles, onSelect, onCreateProfile }: ProfileSelectorProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleCreateComplete = (profileData: Omit<Profile, 'id' | 'createdAt'>) => {
    onCreateProfile(profileData)
    setShowCreateForm(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg"
      >
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">Welcome to My Doctor AI</h1>
        <p className="text-gray-500 text-center mb-8">Select a profile to continue</p>

        {!showCreateForm ? (
          <div className="space-y-3">
            {profiles.length > 0 ? (
              profiles.map((profile) => (
                <motion.button
                  key={profile.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelect(profile)}
                  className="w-full p-4 text-left bg-gray-50 hover:bg-primary-50 rounded-xl border-2 border-transparent hover:border-primary-400 transition-all flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-primary-300" />
                  </div>
                  <div className="flex-1">
                    <span className="text-gray-700 font-medium block">{profile.name}</span>
                    <span className="text-gray-400 text-sm capitalize">{profile.type}</span>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No profiles yet. Create one to get started.</p>
            )}
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreateForm(true)}
              className="w-full p-4 text-left bg-primary-50 hover:bg-primary-100 rounded-xl border-2 border-primary-300 hover:border-primary-400 transition-all flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold">
                +
              </div>
              <span className="text-primary-700 font-medium">Create New Profile</span>
            </motion.button>
          </div>
        ) : (
          <CreateProfileForm 
            onComplete={handleCreateComplete} 
            onBack={() => setShowCreateForm(false)} 
          />
        )}
      </motion.div>
    </div>
  )
}