import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

interface Session {
  id: string
  title: string
  date: string
  preview: string
}

export default function Dashboard() {
  const navigate = useNavigate()

  const recentSessions: Session[] = [
    { id: '1', title: 'Headache and fatigue', date: 'Today', preview: 'I have been experiencing...' },
    { id: '2', title: 'Chest pain consultation', date: 'Yesterday', preview: 'Started feeling chest discomfort...' },
    { id: '3', title: 'Medication review', date: '3 days ago', preview: 'I am taking aspirin daily...' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Health Dashboard</h1>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <p className="text-gray-500 text-sm">Total Sessions</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">12</p>
          <p className="text-green-500 text-sm mt-2">+3 this week</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <p className="text-gray-500 text-sm">Documents</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">5</p>
          <p className="text-gray-400 text-sm mt-2">Medical notes</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <p className="text-gray-500 text-sm">Tools</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">0</p>
          <p className="text-gray-400 text-sm mt-2">Enabled</p>
        </motion.div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">Recent Conversations</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {recentSessions.map((session, index) => (
            <motion.button
              key={session.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate('/chat', { state: { sessionId: session.id } })}
              className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-800">{session.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">{session.preview}</p>
                </div>
                <span className="text-sm text-gray-400">{session.date}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}