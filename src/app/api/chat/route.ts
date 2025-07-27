import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { Groq } from 'groq-sdk'
import { OpenAI } from 'openai'
import { Exa } from 'exa-js'

const systemPrompt = `You are Aven's customer service AI assistant. You help customers with questions about Aven Card, which is a financial services product that helps users build credit and manage their finances.

Your role is to:
- Provide helpful, accurate information about Aven Card features and services
- Guide customers through common processes and troubleshooting
- Maintain a friendly, professional, and supportive tone
- Use the provided context from Aven's official documentation and website
- If you don't know something specific, direct customers to contact Aven support directly

Always prioritize customer satisfaction and provide clear, actionable responses based on the retrieved information about Aven.`

export async function POST(req: NextRequest) {
    const data = await req.json()

    // initialize pinecone
    const pc = new Pinecone({
        apiKey: process.env.NEXT_PUBLIC_PINECONE_API_KEY!,
    })

    const index = pc.index('arven').namespace('company-documents')

    // initialize groq
    const groq = new Groq({
        apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY,
    })
    
    // initialize openai
    const openai = new OpenAI({ 
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    })

    // Get the latest user message
        const text = data[data.length - 1].content
    
     // create embedding for the user query
     const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
    })

    // query pinecone for relevant information about Aven
    const results = await index.query({
        topK: 3, // get top 3 most relevant results
        includeMetadata: true,
        vector: embedding.data[0].embedding,
    })

    // format results for context
    let contextString = '\n\nRelevant Aven Documentation:\n'
    results.matches.forEach((match, index) => {
        if (match.score && match.score > 0.7) { // only include high-confidence matches
            contextString += `
                Context ${index + 1}:
                Title: ${match.metadata?.title || 'Aven Documentation'}
                Content: ${match.metadata?.content || match.metadata?.text || ''}
                Source: ${match.metadata?.url || 'Aven Official Documentation'}
                Relevance Score: ${(match.score * 100).toFixed(1)}%
                ---
            `
        }
    })

    // if no high-confidence matches, try real-time search with Exa
    if (results.matches.length === 0 || results.matches[0].score! < 0.7) {
      contextString += await searchWithExa(text)
    }

    // prepare improved message with context
    const lastMessage = data[data.length - 1]
    const lastMessageContent = lastMessage.content + contextString
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1)

    // create completion with Groq
    const completion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            ...lastDataWithoutLastMessage,
            { role: 'user', content: lastMessageContent },
        ],
        model: 'llama-3.1-8b-instant', 
        stream: true,
        // temperature: 0.7,
        // max_tokens: 1000,
    })

    // create completion with OpenAI
    // const completion = await openai.chat.completions.create({
    //     messages: [
    //         { role: 'system', content: systemPrompt },
    //         ...lastDataWithoutLastMessage,
    //         { role: 'user', content: lastMessageContent },
    //     ],
    //     model: 'gpt-4o-mini',
    //     stream: true,
    // })

    // create streaming response
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()
            try {
                for await (const chunk of completion) {
                    const content = chunk.choices[0]?.delta?.content
                    if (content) {
                        const text = encoder.encode(content)
                        controller.enqueue(text)
                    }
                }
            } catch (err) {
                console.error('Streaming error:', err)
                controller.error(err)
            } finally {
                controller.close()
            }
        },
    })
        
    return new NextResponse(stream)
}


async function searchWithExa(query: string): Promise<string> {
    // initialize exa
    const exa = new Exa(process.env.NEXT_PUBLIC_EXA_API_KEY)
    // Search queries specific to Aven
    const searchQueries = [
      `site:aven.com "${query}" support help`,
      `site:aven.com "aven card" ${query}`,
      `"Aven card" ${query} customer service help`,
      `Aven financial services ${query} support`
    ]
    
    let exaResults = '\n\nReal-time Aven Information:\n'

    // for (const searchQuery of searchQueries.slice(0, 2)) { // limiting to 2 queries to avoid rate limits
    for (const searchQuery of searchQueries) {
        try {
            const results = await exa.searchAndContents(searchQuery, {
            type: "neural",
            numResults: 3,
            text: true,
            highlights: true,
            useAutoprompt: true,
            startPublishedDate: "2023-01-01",
            includeDomains: ["aven.com"] // Focus on official Aven content
            })
        
            results.results.forEach((result, index) => {
                if (result.text && result.text.length > 100) {
                    exaResults += `
                        Real-time Result ${index + 1}:
                        Title: ${result.title}
                        Content: ${result.text.substring(0, 500)}...
                        URL: ${result.url}
                        Published: ${result.publishedDate || 'Recent'}
                        ---
                    `
                }
            })

        } catch (searchError) {
            console.error(`Error with Exa search query "${searchQuery}":`, searchError)
            continue
        }
    }
    
    return exaResults
}


export async function updatePineconeIndex() {
    const exa = new Exa(process.env.NEXT_PUBLIC_EXA_API_KEY!)
    const pc = new Pinecone({ apiKey: process.env.NEXT_PUBLIC_PINECONE_API_KEY! })
    const index = pc.index('aven-support').namespace('aven-docs')
    const openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY! })
    
    const searchQueries = [
      'site:aven.com aven card',
      'site:aven.com "aven card" support articles',
      'site:aven.com "aven card" education how it works',
      'site:aven.com "aven card" reviews testimonials',
      'site:aven.com "aven card" about us',
      'site:aven.com "aven card" features benefits',
      'site:aven.com "aven card" application process',
      'site:aven.com "aven card" customer support help'
    ]
    
    const allResults = []

    for (const query of searchQueries) {
        try {
            const results = await exa.searchAndContents(query, {
                type: "neural",
                numResults: Math.floor(100 / searchQueries.length),
                text: true,
                highlights: true,
                useAutoprompt: true,
                startPublishedDate: "2023-01-01"
            })
            allResults.push(...results.results)
        } catch (e) {
            console.error(`Error searching for query '${query}':`, e)
            continue
        }
    }

    // Process and upsert to Pinecone
    const vectors = []
    
    for (let i = 0; i < allResults.length; i++) {
      const result = allResults[i]
      if (result.text && result.text.length > 50) {
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: result.text,
          encoding_format: 'float',
        })
        
        vectors.push({
          id: `aven-doc-${i}-${Date.now()}`,
          values: embedding.data[0].embedding,
          metadata: {
            title: result.title ?? '',
            content: result.text,
            url: result.url ?? '',
            publishedDate: result.publishedDate ?? '',
            highlights: result.highlights?.join(' ') || '',
            source: 'exa-search'
          }
        })
      }
    }
    
    // Upsert in batches
    const batchSize = 100
    for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize)
        await index.upsert(batch)
    }
    
    console.log(`Successfully updated Pinecone index with ${vectors.length} vectors`)
}