// Document tools - for AI to access stored documents
export { documentsStore } from './store'
export { registerDocumentsHandlers, registerDocumentsOcrHandler } from './handlers'

// Import documents store for tool execution
import { documentsStore } from './store'

// Tool definitions for AI with execute functions embedded
export const getDocumentsTool = {
  type: 'function' as const,
  name: 'get_documents',
  description: 'Get all documents stored for the user. Returns document list including id, name, type, content preview, and creation date. Use this when user asks about their medical documents or notes.',
  parameters: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
  execute: async () => {
    try {
      console.log('[Tool] get_documents called, accessing store...')
      const docs = documentsStore.getDocuments()
      console.log('[Tool] Found documents:', docs?.length || 0)
      
      if (!docs || docs.length === 0) {
        return JSON.stringify({
          success: true,
          documents: [],
          message: 'No documents stored yet. User can add documents through the Documents page.'
        }, null, 2)
      }
      
      // Return summary (not full content for brevity)
      const summary = docs.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        contentLength: doc.content.length,
        preview: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
        createdAt: doc.createdAt
      }))
      
      return JSON.stringify({
        success: true,
        documents: summary,
        count: docs.length
      }, null, 2)
    } catch (error) {
      console.error('[Tool] get_documents error:', error)
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

export const searchDocumentsTool = {
  type: 'function' as const,
  name: 'search_documents',
  description: 'Search through user documents by content. Returns matching documents with relevant excerpts. Use this when user asks about specific information from their documents.',
  parameters: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string' as const,
        description: 'Search query to find relevant documents',
      },
    },
    required: ['query'],
  },
  execute: async (args: Record<string, unknown>) => {
    try {
      const query = args.query as string
      console.log('[Tool] search_documents called with query:', query)
      const docs = documentsStore.searchDocuments(query)
      console.log('[Tool] Found matching documents:', docs?.length || 0)
      
      if (!docs || docs.length === 0) {
        return JSON.stringify({
          success: true,
          results: [],
          message: `No documents found matching: "${query}"`
        }, null, 2)
      }
      
      // Return matching documents
      return JSON.stringify({
        success: true,
        results: docs.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          content: doc.content,
          relevance: 'high'
        })),
        count: docs.length
      }, null, 2)
    } catch (error) {
      console.error('[Tool] search_documents error:', error)
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}