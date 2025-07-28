// import { NextRequest, NextResponse } from 'next/server'
// import { Pinecone } from '@pinecone-database/pinecone'
// import { Groq } from 'groq-sdk'
// import { Exa } from 'exa-js'
// import { randomUUID } from 'crypto'

// const systemPrompt = `You are Aven's customer service AI assistant. You help customers with questions about Aven Card, which is a financial services product that helps users build credit and manage their finances.

// Your role is to:
// - Provide helpful, accurate information about Aven Card features and services
// - Guide customers through common processes and troubleshooting
// - Maintain a friendly, professional, and supportive tone
// - Use the provided context from Aven's official documentation and website
// - If you don't know something specific, direct customers to contact Aven support directly

// Always prioritize customer satisfaction and provide clear, actionable responses based on the retrieved information about Aven.`

// //to get embeddings from Hugging Face API
// async function getHuggingFaceEmbeddings(text: string): Promise<number[]> {
//     // use the correct HF Inference API endpoint
//     const response = await fetch(
//         'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
//         {
//             headers: {
//                 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY}`,
//                 'Content-Type': 'application/json',
//             },
//             method: 'POST',
//             body: JSON.stringify({
//                 inputs: text
//             }),
//         }
//     )

//     if (!response.ok) {
//         const errorText = await response.text()
//         console.error(`Hugging Face API error: ${response.status} - ${errorText}`)
//         throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`)
//     }

//     const result = await response.json()
//     console.log('HF API response sample:', JSON.stringify(result).substring(0, 200))
    
//     // The response should be a 2D array where each inner array is an embedding
//     if (Array.isArray(result) && result.length > 0) {
//         if (Array.isArray(result[0])) {
//             console.log('Embedding dimensions:', result[0].length)
//             return result[0] // Return the first (and likely only) embedding
//         }
//     }
    
//     console.error('Unexpected HF response format:', typeof result)
//     throw new Error('Unexpected response format from Hugging Face API')
// }

// export async function POST(req: NextRequest) {
//     try {
//         const data = await req.json()

//         // initialize pinecone
//         const pc = new Pinecone({
//             apiKey: process.env.NEXT_PUBLIC_PINECONE_API_KEY!,
//         })

//         const index = pc.index('arven').namespace('company-documents')

//         // initialize groq
//         const groq = new Groq({
//             apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY,
//         })

//         // Get the latest user message
//         const text = data[data.length - 1].content
//         console.log('User query:', text)
    
//         // Create embedding using Hugging Face API instead of OpenAI
//         console.log('Creating embedding with Hugging Face...')
//         let embedding: number[]
//         try {
//             embedding = await getHuggingFaceEmbeddings(text)
//             console.log('Hugging Face embedding created successfully, length:', embedding.length)
//         } catch (embeddingError) {
//             console.error('Hugging Face embedding failed:', embeddingError)
//             // Continue without embeddings - use fallback approach
//             const lastMessage = data[data.length - 1]
//             const lastDataWithoutLastMessage = data.slice(0, data.length - 1)

//             // Try Exa search as fallback
//             let contextString = ''
//             try {
//                 console.log('Trying Exa search as fallback...')
//                 contextString = await searchWithExa(text)
//             } catch (exaError) {
//                 console.error('Exa search also failed:', exaError)
//                 contextString = '\n\nNote: Unable to retrieve specific documentation at the moment.'
//             }

//             const lastMessageContent = lastMessage.content + contextString

//             // Create completion with Groq using fallback context
//             console.log('Calling Groq with fallback context...')
//             const completion = await groq.chat.completions.create({
//                 messages: [
//                     { role: 'system', content: systemPrompt },
//                     ...lastDataWithoutLastMessage,
//                     { role: 'user', content: lastMessageContent },
//                 ],
//                 model: 'llama-3.1-8b-instant', 
//                 stream: true,
//             })

//             // Create streaming response
//             const stream = new ReadableStream({
//                 async start(controller) {
//                     const encoder = new TextEncoder()
//                     try {
//                         for await (const chunk of completion) {
//                             const content = chunk.choices[0]?.delta?.content
//                             if (content) {
//                                 const text = encoder.encode(content)
//                                 controller.enqueue(text)
//                             }
//                         }
//                     } catch (err) {
//                         console.error('Streaming error:', err)
//                         controller.error(err)
//                     } finally {
//                         controller.close()
//                     }
//                 },
//             })
                
//             return new NextResponse(stream)
//         }

//         // Query pinecone for relevant information about Aven
//         console.log('Searching Pinecone...')
//         const results = await index.query({
//             topK: 3, // get top 3 most relevant results
//             includeMetadata: true,
//             vector: embedding, // Use HF embedding instead of OpenAI
//         })

//         // Format results for context
//         let contextString = '\n\nRelevant Aven Documentation:\n'
//         results.matches.forEach((match, index) => {
//             if (match.score && match.score > 0.7) { // only include high-confidence matches
//                 contextString += `
//                     Context ${index + 1}:
//                     Title: ${match.metadata?.title || 'Aven Documentation'}
//                     Content: ${match.metadata?.content || match.metadata?.text || ''}
//                     Source: ${match.metadata?.url || 'Aven Official Documentation'}
//                     Relevance Score: ${(match.score * 100).toFixed(1)}%
//                     ---
//                 `
//             }
//         })

//         // If no high-confidence matches, try real-time search with Exa
//         if (results.matches.length === 0 || results.matches[0].score! < 0.7) {
//             console.log('Low confidence matches, searching with Exa...')
//             try {
//                 contextString += await searchWithExa(text)
//             } catch (exaError) {
//                 console.error('Exa search failed:', exaError)
//                 // Continue without Exa results
//             }
//         }

//         // Prepare improved message with context
//         const lastMessage = data[data.length - 1]
//         const lastMessageContent = lastMessage.content + contextString
//         const lastDataWithoutLastMessage = data.slice(0, data.length - 1)

//         // Create completion with Groq
//         console.log('Calling Groq for completion...')
//         const completion = await groq.chat.completions.create({
//             messages: [
//                 { role: 'system', content: systemPrompt },
//                 ...lastDataWithoutLastMessage,
//                 { role: 'user', content: lastMessageContent },
//             ],
//             model: 'llama-3.1-8b-instant', 
//             stream: true,
//             // temperature: 0.7,
//             // max_tokens: 1000,
//         })

//         // Create streaming response
//         const stream = new ReadableStream({
//             async start(controller) {
//                 const encoder = new TextEncoder()
//                 try {
//                     for await (const chunk of completion) {
//                         const content = chunk.choices[0]?.delta?.content
//                         if (content) {
//                             const text = encoder.encode(content)
//                             controller.enqueue(text)
//                         }
//                     }
//                 } catch (err) {
//                     console.error('Streaming error:', err)
//                     controller.error(err)
//                 } finally {
//                     controller.close()
//                 }
//             },
//         })
            
//         return new NextResponse(stream)
        
//     } catch (error) {
//         console.error('Error in chat API:', error)
//         console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
//         return NextResponse.json(
//             { 
//                 error: 'Internal server error',
//                 details: error instanceof Error ? error.message : 'Unknown error',
//                 timestamp: new Date().toISOString()
//             },
//             { status: 500 }
//         )
//     }
// }

// // Fallback function for chat without RAG
// async function chatWithoutRAG(data: any[], groq: Groq) {
//     console.log('Using fallback chat without RAG...')
    
//     const completion = await groq.chat.completions.create({
//         messages: [
//             { role: 'system', content: systemPrompt + '\n\nNote: Currently operating without access to specific Aven documentation. Please provide general assistance and direct users to official Aven support for specific account issues.' },
//             ...data,
//         ],
//         model: 'llama-3.1-8b-instant',
//         stream: true,
//     })
    
//     const stream = new ReadableStream({
//         async start(controller) {
//             const encoder = new TextEncoder()
//             try {
//                 for await (const chunk of completion) {
//                     const content = chunk.choices[0]?.delta?.content
//                     if (content) {
//                         const text = encoder.encode(content)
//                         controller.enqueue(text)
//                     }
//                 }
//             } catch (err) {
//                 controller.error(err)
//             } finally {
//                 controller.close()
//             }
//         },
//     })
    
//     return new NextResponse(stream)
// }

// async function searchWithExa(query: string): Promise<string> {
//     // initialize exa
//     const exa = new Exa(process.env.NEXT_PUBLIC_EXA_API_KEY)
//     // Search queries specific to Aven
//     const searchQueries = [
//       `site:aven.com "${query}" support help`,
//       `site:aven.com "aven card" ${query}`,
//       `"Aven card" ${query} customer service help`,
//       `Aven financial services ${query} support`
//     ]
    
//     let exaResults = '\n\nReal-time Aven Information:\n'

//     // for (const searchQuery of searchQueries.slice(0, 2)) { // limiting to 2 queries to avoid rate limits
//     for (const searchQuery of searchQueries) {
//         try {
//             const results = await exa.searchAndContents(searchQuery, {
//             type: "neural",
//             numResults: 3,
//             text: true,
//             highlights: true,
//             useAutoprompt: true,
//             startPublishedDate: "2023-01-01",
//             includeDomains: ["aven.com"] // Focus on official Aven content
//             })
        
//             results.results.forEach((result, index) => {
//                 if (result.text && result.text.length > 100) {
//                     exaResults += `
//                         Real-time Result ${index + 1}:
//                         Title: ${result.title}
//                         Content: ${result.text.substring(0, 500)}...
//                         URL: ${result.url}
//                         Published: ${result.publishedDate || 'Recent'}
//                         ---
//                     `
//                 }
//             })

//         } catch (searchError) {
//             console.error(`Error with Exa search query "${searchQuery}":`, searchError)
//             continue
//         }
//     }
    
//     return exaResults
// }

// // Updated function to populate Pinecone with Hugging Face embeddings
// export async function updatePineconeIndex() {
//     try {
//         const exa = new Exa(process.env.NEXT_PUBLIC_EXA_API_KEY!)
//         const pc = new Pinecone({ apiKey: process.env.NEXT_PUBLIC_PINECONE_API_KEY! })
//         const index = pc.index('arven').namespace('company-documents')
        
//         const searchQueries = [
//           'site:aven.com aven card',
//           'site:aven.com "aven card" support articles',
//           'site:aven.com "aven card" education how it works',
//           'site:aven.com "aven card" reviews testimonials',
//           'site:aven.com "aven card" about us',
//           'site:aven.com "aven card" features benefits',
//           'site:aven.com "aven card" application process',
//           'site:aven.com "aven card" customer support help'
//         ]
        
//         const allResults = []

//         for (const query of searchQueries) {
//             try {
//                 const results = await exa.searchAndContents(query, {
//                     type: "neural",
//                     numResults: Math.floor(100 / searchQueries.length),
//                     text: true,
//                     highlights: true,
//                     useAutoprompt: true,
//                     startPublishedDate: "2023-01-01"
//                 })
//                 allResults.push(...results.results)
//             } catch (e) {
//                 console.error(`Error searching for query '${query}':`, e)
//                 continue
//             }
//         }

//         // Process and upsert to Pinecone using Hugging Face embeddings
//         const vectors = []
        
//         for (let i = 0; i < allResults.length; i++) {
//             const result = allResults[i]
//             if (result.text && result.text.length > 50) {
//                 try {
//                     // Use Hugging Face embeddings instead of OpenAI
//                     const embedding = await getHuggingFaceEmbeddings(result.text)
                    
//                     vectors.push({
//                         id: `aven-doc-${i}-${randomUUID()}`,
//                         values: embedding, // HF embedding
//                         metadata: {
//                             title: result.title ?? '',
//                             content: result.text,
//                             url: result.url ?? '',
//                             publishedDate: result.publishedDate ?? '',
//                             highlights: result.highlights?.join(' ') || '',
//                             source: 'exa-search'
//                         }
//                     })
                    
//                     // Add a small delay to avoid rate limiting
//                     await new Promise(resolve => setTimeout(resolve, 100))
                    
//                 } catch (embeddingError) {
//                     console.error(`Error creating embedding for result ${i}:`, embeddingError)
//                     continue
//                 }
//             }
//         }
        
//         // Upsert in batches
//         const batchSize = 100
//         for (let i = 0; i < vectors.length; i += batchSize) {
//             const batch = vectors.slice(i, i + batchSize)
//             await index.upsert(batch)
//             console.log(`Uploaded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(vectors.length/batchSize)}`)
//         }
        
//         console.log(`Successfully updated Pinecone index with ${vectors.length} vectors using Hugging Face embeddings`)
        
//     } catch (error) {
//         console.error('Error updating Pinecone index:', error)
//         throw error
//     }
// }

