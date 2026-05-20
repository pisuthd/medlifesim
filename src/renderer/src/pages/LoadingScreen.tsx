import { useState, useEffect } from 'react'

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(onComplete, 400)
          return 100
        }
        return prev + Math.random() * 15
      })
    }, 200)

    return () => clearInterval(interval)
  }, [onComplete])

  return (
    <div className="min-h-screen bg-white relative overflow-hidden flex items-center justify-center">
      {/* Abstract blue gradient background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Top right circle */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-primary-200/30 to-primary-400/10" />
        
        {/* Bottom left circle */}
        <div className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-100/40 to-primary-200/20" />
        
        {/* Center circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary-100/30 to-transparent" />
        
        {/* Decorative lines */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-200/50 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-200/30 to-transparent" />
      </div>

      {/* Content */}
      <div className="text-center relative z-10">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-gray-800 mb-2">My Doctor AI</h1>
        <p className="text-gray-400 text-sm mb-8">Loading...</p>

        {/* Progress bar */}
        <div className="w-64 mx-auto">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            <span className="text-xs text-gray-400">
              {progress < 40 ? 'Initializing' : progress < 80 ? 'Loading' : 'Ready'}
            </span>
            <span className="text-xs text-gray-400 font-medium">{Math.round(Math.min(progress, 100))}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}