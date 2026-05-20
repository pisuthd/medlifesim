import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/sessions', label: 'Sessions' },
  { path: '/chat', label: 'New Chat' },
  { path: '/documents', label: 'Documents' },
  { path: '/tools', label: 'Tools' },
]

export default function Sidebar({ profileName }: { profileName: string }) {
  return (
    <div className="w-64 bg-gradient-to-b from-primary-800 to-primary-900 min-h-screen p-4 text-white flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-wide">My Doctor AI</h1>
        <p className="text-primary-300 text-sm mt-1">Welcome, {profileName}</p>
      </div>

      <nav className="space-y-1 flex-1">
        {navItems.map((item, index) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-primary-700 text-white'
                  : 'text-primary-200 hover:bg-primary-700/50'
              }`
            }
          >
            <span className="w-6 h-6 rounded bg-primary-600/50 flex items-center justify-center text-xs font-medium">
              {index + 1}
            </span>
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-primary-700/50">
        <div className="p-3 bg-primary-700/30 rounded-lg">
          <p className="text-xs text-primary-300 uppercase tracking-wider">AI Status</p>
          <p className="text-primary-400 font-medium mt-1">Ready</p>
        </div>
      </div>
    </div>
  )
}