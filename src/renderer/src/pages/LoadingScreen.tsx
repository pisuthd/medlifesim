import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(onComplete, 500)
          return 100
        }
        return prev + Math.random() * 12
      })
    }, 250)

    return () => clearInterval(interval)
  }, [onComplete])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 flex items-center justify-center relative overflow-hidden">
      {/* Expanding rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[0, 1, 2, 3].map((index) => (
          <motion.div
            key={index}
            className="absolute border border-primary-400/30 rounded-full"
            initial={{ width: 80, height: 80, opacity: 0.8 }}
            animate={{
              width: [80, 400],
              height: [80, 400],
              opacity: [0.6, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: index * 0.75,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      {/* Center content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center text-white relative z-10"
      >
        {/* Logo */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <motion.div
            className="absolute inset-0 border-2 border-primary-300 rounded-full"
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="absolute inset-2 bg-primary-600 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-wide mb-2">My Doctor AI</h1>
        <p className="text-primary-300 text-sm tracking-wider mb-8">Initializing</p>

        {/* Progress bar */}
        <div className="w-64 mx-auto">
          <div className="h-1 bg-primary-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-400 to-primary-200 rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-primary-400 uppercase tracking-wider">
              {progress < 50 ? 'Loading Model' : progress < 90 ? 'Preparing Interface' : 'Ready'}
            </span>
            <span className="text-xs text-primary-400">{Math.round(Math.min(progress, 100))}%</span>
          </div>
        </div>
      </motion.div>

      {/* Bottom decoration */}
      <div className="absolute bottom-8 flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-primary-400 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  )
}