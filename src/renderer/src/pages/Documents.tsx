import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useDroppable } from '@dnd-kit/core'
import { useProfile } from '../context/ProfileContext'

const BLUE = '#1A1AE8'
const TEAL = '#3EC4C0'
const NAVY = '#0a0a5c'
const MUTED = '#9999bb'
const LIGHT_BLUE = '#f7f7fc'

const monoFont = "'Space Mono', monospace"
const sansFont = "'DM Sans', sans-serif"

interface DocumentItem {
  id: string
  type: 'text' | 'ocr' | 'note'
  name: string
  content: string
  metadata: {
    originalName?: string
    mimeType?: string
    size?: number
  }
  createdAt: string
  updatedAt: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </p>
  )
}

function DropZone({ onFileDrop }: { onFileDrop: (content: string, name: string, type: 'text' | 'ocr' | 'note') => void }) {
  const [isDragging, setIsDragging] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteName, setNoteName] = useState('')

  const { setNodeRef, isOver } = useDroppable({ id: 'documents-drop-zone' })

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      // For now, read text files directly
      if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          onFileDrop(content, file.name, 'text')
        }
        reader.readAsText(file)
      } else if (file.type.startsWith('image/')) {
        // Images would need OCR - mark as OCR type for future
        onFileDrop(`[Image: ${file.name}]`, file.name, 'ocr')
      } else {
        // PDF or other - read as text if possible
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          onFileDrop(content.substring(0, 5000), file.name, 'text')
        }
        reader.readAsText(file)
      }
    }
  }

  const handleAddNote = () => {
    if (noteContent.trim() && noteName.trim()) {
      onFileDrop(noteContent, noteName, 'note')
      setNoteContent('')
      setNoteName('')
      setShowInput(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Drop zone */}
      <div
        ref={setNodeRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isOver || isDragging ? BLUE : '#e0e0f0'}`,
          borderRadius: 8,
          padding: '48px 32px',
          textAlign: 'center',
          background: isOver || isDragging ? '#f0f0fd' : '#fff',
          transition: 'all 0.2s',
          cursor: 'pointer',
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

      {/* Add note button */}
      {!showInput && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowInput(true)}
          style={{
            padding: '12px 16px',
            background: '#fff',
            border: '1px solid #e0e0f0',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: monoFont,
            fontSize: 11,
            color: MUTED,
            letterSpacing: '0.08em',
          }}
        >
          + ADD QUICK NOTE
        </motion.button>
      )}

      {/* Note input */}
      {showInput && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{
            padding: 16,
            background: '#fff',
            border: '1px solid #e0e0f0',
            borderRadius: 8,
          }}
        >
          <input
            type="text"
            value={noteName}
            onChange={(e) => setNoteName(e.target.value)}
            placeholder="Note title..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #e0e0f0',
              borderRadius: 4,
              marginBottom: 8,
              fontFamily: sansFont,
              fontSize: 13,
              outline: 'none',
            }}
          />
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Write your medical notes here..."
            rows={4}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #e0e0f0',
              borderRadius: 4,
              marginBottom: 8,
              fontFamily: sansFont,
              fontSize: 13,
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAddNote}
              disabled={!noteContent.trim() || !noteName.trim()}
              style={{
                padding: '8px 16px',
                background: noteContent.trim() && noteName.trim() ? BLUE : MUTED,
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                fontFamily: monoFont,
                fontSize: 11,
                cursor: noteContent.trim() && noteName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              SAVE NOTE
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setShowInput(false)
                setNoteContent('')
                setNoteName('')
              }}
              style={{
                padding: '8px 16px',
                background: '#fff',
                border: '1px solid #e0e0f0',
                borderRadius: 4,
                color: MUTED,
                fontFamily: monoFont,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              CANCEL
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString()
}

export default function Documents() {
  const { profile } = useProfile()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)

  // Load documents on mount and profile change
  useEffect(() => {
    if (!profile) {
      setLoading(false)
      return
    }

    const loadDocuments = async () => {
      try {
        await window.api.documents.setProfile(profile.id)
        const docs = await window.api.documents.list()
        setDocuments(docs)
      } catch (error) {
        console.error('Failed to load documents:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDocuments()
  }, [profile])

  const handleFileDrop = async (content: string, name: string, type: 'text' | 'ocr' | 'note') => {
    if (!profile) return

    try {
      const newDoc = await window.api.documents.add({
        type,
        name,
        content,
        metadata: {
          originalName: name,
          size: content.length,
        },
      })
      setDocuments((prev) => [newDoc, ...prev])
    } catch (error) {
      console.error('Failed to add document:', error)
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      await window.api.documents.delete(docId)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

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
          <DropZone onFileDrop={handleFileDrop} />
        </div>

        {/* Files List */}
        <div>
          <h2 style={{ fontFamily: sansFont, fontSize: 16, fontWeight: 300, color: NAVY, marginBottom: 16 }}>
            <strong style={{ fontWeight: 500 }}>Uploaded</strong> files
          </h2>
          
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: MUTED }}>
              Loading...
            </div>
          ) : documents.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: MUTED, background: '#fff', borderRadius: 8, border: '1px solid #e0e0f0' }}>
              No documents yet. Upload files or add notes above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {documents.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
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
                      background: doc.type === 'note' ? TEAL : BLUE,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: monoFont,
                      fontSize: 10,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {doc.type === 'note' ? 'NT' : doc.type === 'ocr' ? 'IMG' : 'TXT'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: sansFont, fontSize: 13, fontWeight: 500, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.name}
                    </span>
                    <span style={{ fontFamily: monoFont, fontSize: 10, color: MUTED }}>
                      {formatDate(doc.createdAt)} • {doc.content.length} chars
                    </span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleDeleteDocument(doc.id)}
                    style={{
                      padding: '4px 8px',
                      background: 'transparent',
                      border: '1px solid #ffcccc',
                      borderRadius: 4,
                      color: '#cc4444',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}