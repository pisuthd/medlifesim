import { useState } from 'react'
import { motion } from 'framer-motion'

interface Tool {
  id: string
  name: string
  description: string
  enabled: boolean
  status: 'available' | 'coming_soon'
}

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([
    {
      id: '1',
      name: 'Clinic Scheduling',
      description: 'Schedule appointments with local clinics directly from chat',
      enabled: false,
      status: 'available',
    },
    {
      id: '2',
      name: 'Medication Reminders',
      description: 'Set reminders for taking medications',
      enabled: false,
      status: 'available',
    },
    {
      id: '3',
      name: 'Health Records',
      description: 'Connect to your electronic health records',
      enabled: false,
      status: 'coming_soon',
    },
    {
      id: '4',
      name: 'Emergency Contacts',
      description: 'Quick access to emergency services and contacts',
      enabled: false,
      status: 'coming_soon',
    },
  ])

  const toggleTool = (id: string) => {
    setTools((prev) =>
      prev.map((tool) =>
        tool.id === id && tool.status === 'available'
          ? { ...tool, enabled: !tool.enabled }
          : tool
      )
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Tools and Integrations</h1>
      <p className="text-gray-500 mb-8">Enable tools to connect with real-world services</p>

      <div className="grid grid-cols-2 gap-6">
        {tools.map((tool, index) => (
          <motion.div
            key={tool.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 ${
              tool.status === 'coming_soon' ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded bg-primary-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{tool.name}</h3>
                  <p className="text-gray-500 text-sm mt-1">{tool.description}</p>
                  {tool.status === 'coming_soon' && (
                    <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                      Coming Soon
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => toggleTool(tool.id)}
                disabled={tool.status === 'coming_soon'}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  tool.enabled ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    tool.enabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}