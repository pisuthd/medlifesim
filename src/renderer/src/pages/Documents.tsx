import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'

interface Document {
  id: string
  name: string
  size: string
  type: string
  uploadedAt: Date
}

function SortableDocument({ doc }: { doc: Document }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-primary-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-800">{doc.name}</p>
            <p className="text-sm text-gray-500">{doc.size} - {doc.type}</p>
          </div>
        </div>
        <span className="text-sm text-gray-400">{doc.uploadedAt.toLocaleDateString()}</span>
      </div>
    </div>
  )
}

function DropZone({ isOver }: { isOver: boolean }) {
  const { setNodeRef, isOver: localIsOver } = useDroppable({ id: 'documents-drop-zone' })
  const isActive = isOver || localIsOver

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        isActive
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-300 bg-gray-50'
      }`}
    >
      <div className="w-12 h-12 mx-auto mb-4 rounded bg-primary-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <p className="text-gray-600 font-medium">Drag and drop medical documents here</p>
      <p className="text-gray-400 text-sm mt-1">PDF, TXT, or image files supported</p>
    </div>
  )
}

export default function Documents() {
  const [documents] = useState<Document[]>([
    { id: '1', name: 'blood_test_results.pdf', size: '2.4 MB', type: 'PDF', uploadedAt: new Date('2024-05-18') },
    { id: '2', name: 'prescription_notes.txt', size: '12 KB', type: 'TXT', uploadedAt: new Date('2024-05-15') },
    { id: '3', name: 'xray_report.jpg', size: '1.8 MB', type: 'Image', uploadedAt: new Date('2024-05-10') },
  ])

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Document Manager</h1>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload Documents</h2>
          <DropZone isOver={false} />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Documents</h2>
          <div className="space-y-3">
            <SortableContext items={documents.map((d) => d.id)} strategy={verticalListSortingStrategy}>
              {documents.map((doc) => (
                <SortableDocument key={doc.id} doc={doc} />
              ))}
            </SortableContext>
          </div>
          {documents.length === 0 && (
            <p className="text-gray-400 text-center py-8">No documents uploaded yet</p>
          )}
        </div>
      </div>
    </div>
  )
}