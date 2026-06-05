// import { loadModel, ocr, unloadModel, OCR_LATIN_RECOGNIZER_1 } from '@qvac/sdk'

// let ocrModelId: string | null = null

// export async function initOcrModel(): Promise<boolean> {
//   if (ocrModelId) {
//     console.log('[OCR] Model already loaded:', ocrModelId)
//     return true
//   }

//   try {
//     console.log('[OCR] Loading OCR model...')
//     ocrModelId = await loadModel({
//       modelSrc: OCR_LATIN_RECOGNIZER_1,
//       modelType: 'ocr',
//       modelConfig: {
//         langList: ['en'],
//         useGPU: false,
//         timeout: 60000,
//         magRatio: 1.5,
//         defaultRotationAngles: [0, 90, 180, 270],
//         contrastRetry: false,
//         lowConfidenceThreshold: 0.5,
//         recognizerBatchSize: 1,
//       },
//     })
//     console.log('[OCR] Model loaded:', ocrModelId)
//     return true
//   } catch (error) {
//     console.error('[OCR] Failed to load model:', error)
//     return false
//   }
// }

// export async function processOcr(imagePath: string): Promise<{ success: boolean; text?: string; error?: string }> {
//   try {
//     // Load model if not already loaded
//     if (!ocrModelId) {
//       const loaded = await initOcrModel()
//       if (!loaded) {
//         return { success: false, error: 'Failed to load OCR model' }
//       }
//     }

//     console.log('[OCR] Processing image:', imagePath)
//     const result = await ocr({
//       modelId: ocrModelId!,
//       image: imagePath,
//       options: {
//         paragraph: false,
//       },
//     })

//     const blocksData = await result.blocks
//     const extractedText = blocksData.map((block) => block.text).join('\n')

//     console.log('[OCR] Extracted', blocksData.length, 'text blocks')
//     return { success: true, text: extractedText }
//   } catch (error) {
//     const message = error instanceof Error ? error.message : 'Unknown error'
//     console.error('[OCR] Processing error:', message)
//     return { success: false, error: message }
//   }
// }

// export async function unloadOcrModel(): Promise<void> {
//   if (ocrModelId) {
//     try {
//       await unloadModel({ modelId: ocrModelId, clearStorage: false })
//       ocrModelId = null
//       console.log('[OCR] Model unloaded')
//     } catch (error) {
//       console.error('[OCR] Failed to unload:', error)
//     }
//   }
// }