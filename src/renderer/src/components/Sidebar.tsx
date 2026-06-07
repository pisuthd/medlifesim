import { NavLink } from 'react-router-dom'
import { BLUE, TEAL, NAVY, MUTED, LIGHT_BLUE, monoFont, sansFont } from '../theme'

const navItems = [
  { path: '/chat', label: 'Chat', num: '01' },
  { path: '/', label: 'Dashboard', num: '02' },
  { path: '/sessions', label: 'Sessions', num: '03' },
  { path: '/settings', label: 'Settings', num: '04' },
]

function Wordmark() {
  return (
    <p style={{ fontFamily: monoFont, fontWeight: 700, fontSize: 16, letterSpacing: '0.04em', color: NAVY, margin: 0 }}>
      <span style={{ color: BLUE }}>MedLife</span>Sim
    </p>
  )
}

export default function Sidebar({ profileName }: { profileName: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 200,
        height: '100vh',
        background: '#fff',
        borderRight: '1px solid #e0e0f0',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: sansFont,
        zIndex: 100,
        boxSizing: 'border-box',
      }}
    >
      {/* Teal top accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: TEAL }} />

      {/* Wordmark */}
      <div style={{ marginBottom: 32 }}>
        <Wordmark />
      </div>

      {/* Nav items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              background: isActive ? BLUE : 'transparent',
              borderRadius: 6,
              textDecoration: 'none',
              color: isActive ? '#fff' : NAVY,
              fontFamily: sansFont,
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              transition: 'all 0.15s',
            })}
          >
            {({ isActive }) => (
              <>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    background: isActive ? 'rgba(255,255,255,0.2)' : LIGHT_BLUE,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: monoFont,
                    fontWeight: 700,
                    fontSize: 10,
                    color: isActive ? '#fff' : MUTED,
                    borderRadius: 0,
                    flexShrink: 0,
                  }}
                >
                  {item.num}
                </span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Profile info */}
      <div
        style={{
          padding: '12px',
          background: LIGHT_BLUE,
          borderRadius: 6,
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: BLUE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: monoFont,
            fontWeight: 700,
            fontSize: 10,
            color: '#fff',
            marginBottom: 8,
          }}
        >
          {profileName.slice(0, 2).toUpperCase()}
        </div>
        <p style={{ fontFamily: sansFont, fontSize: 12, fontWeight: 500, color: NAVY, margin: 0 }}>{profileName}</p>
        <p style={{ fontFamily: monoFont, fontSize: 10, color: MUTED, letterSpacing: '0.08em', marginTop: 2 }}>
          v.1.0.0-beta.1
        </p>
      </div>
    </div>
  )
}