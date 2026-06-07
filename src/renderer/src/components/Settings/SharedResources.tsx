import { NAVY, sansFont } from '../../theme'

export default function SharedResources() {
  return (
    <div>
      <h2 style={{ fontFamily: sansFont, fontSize: 22, fontWeight: 300, color: NAVY, margin: '0 0 16px 0', lineHeight: 1.2 }}>
        Shared<strong style={{ fontWeight: 500 }}>Resources</strong>
      </h2>
      <p style={{ fontFamily: sansFont, fontSize: 14, color: '#6b6b8a' }}>
        Share and access resources with friends and community members.
      </p>
    </div>
  )
}
