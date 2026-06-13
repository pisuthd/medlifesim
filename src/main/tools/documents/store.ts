// import * as fs from 'fs'
// import * as path from 'path'
// import { app } from 'electron'

// export interface Document {
//   id: string
//   type: 'text' | 'ocr' | 'note'
//   name: string
//   content: string
//   metadata: {
//     originalName?: string
//     mimeType?: string
//     size?: number
//   }
//   createdAt: string
//   updatedAt: string
// }

// const DOCS_DIR = 'documents'

// function getDocumentsPath(profileSlug: string): string {
//   return path.join(app.getPath('userData'), 'profiles', profileSlug, DOCS_DIR)
// }

// function getDocumentPath(profileSlug: string, docId: string): string {
//   return path.join(getDocumentsPath(profileSlug), `${docId}.json`)
// }

// function generateId(): string {
//   return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10)
// }

// class DocumentsStore {
//   private profileSlug: string = ''

//   setProfile(profileSlug: string): void {
//     this.profileSlug = profileSlug
//   }

//   private ensureDir(): void {
//     const docsPath = getDocumentsPath(this.profileSlug)
//     if (!fs.existsSync(docsPath)) {
//       fs.mkdirSync(docsPath, { recursive: true })
//     }
//   }

//   getDocuments(): Document[] {
//     if (!this.profileSlug) return []
    
//     const docsPath = getDocumentsPath(this.profileSlug)
//     if (!fs.existsSync(docsPath)) return []

//     try {
//       const files = fs.readdirSync(docsPath).filter(f => f.endsWith('.json'))
//       const docs: Document[] = []
      
//       for (const file of files) {
//         const filePath = path.join(docsPath, file)
//         const content = fs.readFileSync(filePath, 'utf-8')
//         docs.push(JSON.parse(content))
//       }
      
//       return docs.sort((a, b) => 
//         new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
//       )
//     } catch {
//       return []
//     }
//   }

//   getDocument(id: string): Document | null {
//     if (!this.profileSlug) return null
    
//     const filePath = getDocumentPath(this.profileSlug, id)
//     if (!fs.existsSync(filePath)) return null

//     try {
//       const content = fs.readFileSync(filePath, 'utf-8')
//       return JSON.parse(content)
//     } catch {
//       return null
//     }
//   }

//   addDocument(doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Document {
//     if (!this.profileSlug) throw new Error('No profile set')
    
//     this.ensureDir()
    
//     const id = generateId()
//     const now = new Date().toISOString()
    
//     const newDoc: Document = {
//       ...doc,
//       id,
//       createdAt: now,
//       updatedAt: now,
//     }
    
//     const filePath = getDocumentPath(this.profileSlug, id)
//     fs.writeFileSync(filePath, JSON.stringify(newDoc, null, 2))
    
//     return newDoc
//   }

//   updateDocument(id: string, updates: Partial<Document>): Document | null {
//     if (!this.profileSlug) return null
    
//     const existing = this.getDocument(id)
//     if (!existing) return null

//     const updated: Document = {
//       ...existing,
//       ...updates,
//       id: existing.id,
//       createdAt: existing.createdAt,
//       updatedAt: new Date().toISOString(),
//     }
    
//     const filePath = getDocumentPath(this.profileSlug, id)
//     fs.writeFileSync(filePath, JSON.stringify(updated, null, 2))
    
//     return updated
//   }

//   deleteDocument(id: string): boolean {
//     if (!this.profileSlug) return false
    
//     const filePath = getDocumentPath(this.profileSlug, id)
//     if (!fs.existsSync(filePath)) return false

//     try {
//       fs.unlinkSync(filePath)
//       return true
//     } catch {
//       return false
//     }
//   }

//   searchDocuments(query: string): Document[] {
//     const docs = this.getDocuments()
//     const lowerQuery = query.toLowerCase()
    
//     return docs.filter(doc => 
//       doc.content.toLowerCase().includes(lowerQuery) ||
//       doc.name.toLowerCase().includes(lowerQuery)
//     )
//   }
// }

// // Create singleton instance
// const documentsStore = new DocumentsStore()

// export { documentsStore }

// // Expose to global for tool access
// ;(global as unknown as { documentsStore: DocumentsStore }).documentsStore = documentsStore