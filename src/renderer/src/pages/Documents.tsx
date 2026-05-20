import { useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import { motion } from 'framer-motion'

const BLUE = '#1A1AE8'
const TEAL = '#3EC4C0'
const NAVY = '#0a0a5c'
const MUTED = '#9999bb'
const LIGHT_BLUE = '#f7f7fc'

const monoFont = "'Space Mono', monospace"
const sansFont = "'DM Sans', sans-serif"

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </p>
  )
}

interface Document {
  id: string
  name: string
  size: string
  type: string
}

function DropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'documents-drop-zone' })

  return (
    <div
      ref={setNodeRef}
      style={{
        border: `2px dashed ${isOver ? BLUE : '#e0e0f0'}`,
        borderRadius: 8,
        padding: '48px 32px',
        textAlign: 'center',
        background: isOver ? '#f0f0fd' : '#fff',
        transition: 'all 0.2s',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          background: LIGHT_BLUE,
          borderRadius: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <span style={{ fontFamily: monoFont, fontSize: 20, color: TEAL }}>+</span>
      </div>
      <p style={{ fontFamily: sansFont, fontSize: 14, color: NAVY, marginBottom: 4 }}>Drop files here or click to upload</p>
      <p style={{ fontFamily: monoFont, fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>PDF, TXT, JPG supported</p>
    </div>
  )
}

export default function Documents() {
  const [documents] = useState<Document[]>([
    { id: '1', name: 'blood_test_results.pdf', size: '2.4 MB', type: 'PDF' },
    { id: '2', name: 'prescription_notes.txt', size: '12 KB', type: 'TXT' },
    { id: '3', name: 'xray_report.jpg', size: '1.8 MB', type: 'Image' },
  ])

  return (
    <div style={{ padding: '32px', fontFamily: sansFont }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel>Documents</SectionLabel>
        <h1 style={{ fontFamily: sansFont, fontSize: 28, fontWeight: 300, color: NAVY, margin: 0, lineHeight: 1.2 }}>
          <strong style={{ fontWeight: 500 }}>Your</strong> medical documents
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Upload */}
        <div>
          <h2 style={{ fontFamily: sansFont, fontSize: 16, fontWeight: 300, color: NAVY, marginBottom: 16 }}>
            <strong style={{ fontWeight: 500 }}>Upload</strong> documents
          </h2>
          <DropZone />
        </div>

        {/* Files List */}
        <div>
          <h2 style={{ fontFamily: sansFont, fontSize: 16, fontWeight: 300, color: NAVY, marginBottom: 16 }}>
            <strong style={{ fontWeight: 500 }}>Uploaded</strong> files
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {documents.map((doc) => (
              <motion.div
                key={doc.id}
                whileHover={{ x: 4 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: '#fff',
                  border: '1px solid #e0e0f0',
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: BLUE,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: monoFont,
                    fontSize: 10,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {doc.type.slice(0, 3).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontFamily: sansFont, fontSize: 13, fontWeight: 500, color: NAVY }}>{doc.name}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 10, color: MUTED }}>{doc.size}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}