import { NAVY, MUTED, monoFont, sansFont } from '../../theme'

export default function About() {
  return (
    <div>
      <h2 style={{ fontFamily: sansFont, fontSize: 22, fontWeight: 300, color: NAVY, margin: '0 0 16px 0', lineHeight: 1.2 }}>
        About <strong style={{ fontWeight: 500 }}>MedLifeSim</strong>
      </h2>
      <p style={{ fontFamily: sansFont, fontSize: 14, color: MUTED, marginBottom: 16 }}>
        Medical simulation platform powered by AI.
      </p>
      <p style={{ fontFamily: monoFont, fontSize: 12, color: MUTED, letterSpacing: '0.08em' }}>
        v.1.0.0-beta.1
      </p>
    </div>
  )
}
