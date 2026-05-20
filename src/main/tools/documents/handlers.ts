import { ipcMain } from 'electron'
import * as fs from 'fs'
import { documentsStore, Document } from './store'
import { processOcr } from '../../ocr'

// Register documents IPC handlers
export function registerDocumentsHandlers(): void {
  // List all documents
  ipcMain.handle('documents:list', async () => {
    try {
      const docs = documentsStore.getDocuments()
      return docs
    } catch (error) {
      console.error('[Documents] Failed to list:', error)
      throw error
    }
  })

  // Get single document
  ipcMain.handle('documents:get', async (_event, docId: string) => {
    try {
      const doc = documentsStore.getDocument(docId)
      return doc
    } catch (error) {
      console.error('[Documents] Failed to get:', error)
      throw error
    }
  })

  // Add document
  ipcMain.handle('documents:add', async (
    _event,
    doc: { type: 'text' | 'ocr' | 'note'; name: string; content: string; metadata?: Record<string, unknown> }
  ) => {
    try {
      const newDoc = documentsStore.addDocument({
        type: doc.type,
        name: doc.name,
        content: doc.content,
        metadata: doc.metadata || {},
      })
      return newDoc
    } catch (error) {
      console.error('[Documents] Failed to add:', error)
      throw error
    }
  })

  // Update document
  ipcMain.handle('documents:update', async (
    _event,
    docId: string,
    updates: Partial<Document>
  ) => {
    try {
      const updated = documentsStore.updateDocument(docId, updates)
      return { success: !!updated, document: updated }
    } catch (error) {
      console.error('[Documents] Failed to update:', error)
      throw error
    }
  })

  // Delete document
  ipcMain.handle('documents:delete', async (_event, docId: string) => {
    try {
      const deleted = documentsStore.deleteDocument(docId)
      return { success: deleted }
    } catch (error) {
      console.error('[Documents] Failed to delete:', error)
      throw error
    }
  })

  // Search documents
  ipcMain.handle('documents:search', async (_event, query: string) => {
    try {
      const results = documentsStore.searchDocuments(query)
      return results
    } catch (error) {
      console.error('[Documents] Failed to search:', error)
      throw error
    }
  })

  // Set current profile (for tool access)
  ipcMain.handle('documents:setProfile', async (_event, profileSlug: string) => {
    try {
      documentsStore.setProfile(profileSlug)
      return { success: true }
    } catch (error) {
      console.error('[Documents] Failed to set profile:', error)
      throw error
    }
  })

  console.log('[Documents] IPC handlers registered')
}

// OCR processor - process image file and return extracted text
export function registerDocumentsOcrHandler(): void {
  ipcMain.handle('documents:processOcr', async (_event, imagePath: string) => {
    try {
      console.log('[Documents] Processing OCR for:', imagePath)
      
      // Verify file exists
      if (!fs.existsSync(imagePath)) {
        console.error('[Documents] File not found:', imagePath)
        return { success: false, error: `File not found: ${imagePath}` }
      }
      
      const result = await processOcr(imagePath)
      return result
    } catch (error) {
      console.error('[Documents] OCR failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
  
  console.log('[Documents] OCR handler registered')
}