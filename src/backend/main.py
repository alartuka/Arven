from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv
import numpy as np
from sentence_transformers import SentenceTransformer
from langchain_community.embeddings import HuggingFaceEmbeddings
from groq import Groq
from pinecone import Pinecone
import time
from urllib.parse import urlparse

# load environment variables
load_dotenv()

app = FastAPI(title="Aven RAG API", version="1.0.0")

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://arven-ai.vercel.app"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# global variables for clients
embeddings = None
groq_client = None
pinecone_index = None

# initialize clients and models with better error handling
def initialize_services():
    global embeddings, groq_client, pinecone_index
    
    try:
        # check environment variables
        required_vars = ['GROQ_API_KEY', 'PINECONE_API_KEY']
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        
        if missing_vars:
            raise ValueError(f"Missing environment variables: {', '.join(missing_vars)}")
        
        print(">>> Checking API keys...")
        print(f"GROQ_API_KEY: {'>>> Set' if os.getenv('GROQ_API_KEY') else '>>> Missing'}")
        print(f"PINECONE_API_KEY: {'>>> Set' if os.getenv('PINECONE_API_KEY') else '>>> Missing'}")
        
        # initialize embeddings
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        print(">>> Embeddings initialized")
        
        # initialize Groq client
        groq_client = Groq(api_key=os.getenv('GROQ_API_KEY'))
        print(">>> Groq client initialized")
        
        
        # initialize Pinecone
        pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
        index_name = "arven"
        # namespace = "company-documents"
        
        pinecone_index = pc.Index(index_name)
        
        print(">>> All services initialized successfully")
        return True
        
    except Exception as e:
        print(f">>> Initialization error: {e}")
        return False

# initialize services on startup
startup_success = initialize_services()

if startup_success:
    print(">>> RAG API ready for serving requests!")
else:
    print(">>> RAG API startup failed. Check your configuration.")



# pydantic data models
class SourceInfo(BaseModel):
    source: str
    title: str
    score: float
    domain: str
    verified_aven: bool
    crawl_method: Optional[str] = None
    source_type: Optional[str] = None
    is_aven_domain: bool

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: Optional[str] = None
    sources: Optional[list] = None



def get_huggingface_embeddings(text, model_name="sentence-transformers/all-MiniLM-L6-v2"):
    """Get embeddings for text using HuggingFace model"""
    model = SentenceTransformer(model_name)
    return model.encode(text)



def perform_rag(query: str):
    """Perform RAG query and return response"""
    global groq_client, pinecone_index
    
    try:
        print(f">>> Processing query: {query[:50]}...")
        
        # check if services are initialized
        if not groq_client or not pinecone_index:
            raise HTTPException(status_code=500, detail="Services not properly initialized")
        
        # get query embedding
        print(">>> Getting embeddings...")
        raw_query_embedding = get_huggingface_embeddings(query)
        query_embedding = np.array(raw_query_embedding)

        # query Pinecone
        print(">>> Querying Pinecone...")
        try:
            top_matches = pinecone_index.query(
                vector=query_embedding.tolist(), 
                top_k=15,  # increased to get more potential matches before filtering
                include_metadata=True, 
                namespace="company-documents"
            )
            print(f">>> Found {len(top_matches.get('matches', []))} matches")
        except Exception as e:
            print(f">>> Pinecone query failed: {e}")
            raise HTTPException(status_code=500, detail=f"Vector search failed: {str(e)}")

        # extract contexts and sources with domain filtering
        contexts = []
        sources = []
        filtered_count = 0
        
        for item in top_matches.get('matches', []):
            metadata = item.get('metadata', {})
            
            # extra safety check: verify domain in RAG retrieval
            source_url = metadata.get('source', '')
            if source_url:
                domain = urlparse(source_url).netloc.lower()
                
                # skip non-aven.com sources (extra safety)
                if not (domain == 'aven.com' or domain.endswith('.aven.com')):
                    print(f">>>  Filtering out non-Aven source in RAG: {domain}")
                    filtered_count += 1
                    continue
            
            # try different possible content fields
            content = None
            for field in ['text', 'page_content', 'content']:
                if field in metadata and metadata[field]:
                    content = metadata[field]
                    break
            
            if content:
                contexts.append(content)
                
                # extract source information
                source_info = {
                    'source': source_url,
                    'title': metadata.get('title', 'Unknown'),
                    'score': item.get('score', 0.0),
                    'domain': domain if source_url else 'unknown',
                    'verified_aven': metadata.get('verified_aven', False),
                    'crawl_method': metadata.get('crawl_method', 'unknown'),
                    'source_type': metadata.get('source_type', 'unknown')
                }
                sources.append(source_info)
            
            # stop after we have enough valid contexts
            if len(contexts) >= 10:
                break

        if filtered_count > 0:
            print(f">>> Filtered out {filtered_count} non-Aven sources during RAG retrieval")

        print(f">>> Extracted {len(contexts)} contexts from Aven sources")
        
        # handle case where no relevant context is found
        if not contexts:
            return "I don't have enough information in my current knowledge base to answer your question accurately. This might be because the content hasn't been crawled yet, or your question is about topics not covered in the available content. For the most up-to-date information, please contact Aven customer support or visit our website.", []

        # create augmented query
        augmented_query = "<CONTEXT>\n" + "\n\n-------\n\n".join(contexts[:10]) + "\n-------\n</CONTEXT>\n\n\n\nMY QUESTION:\n" + query

        system_prompt = """Your name is Arven.

You are the official AI Customer Support agent for Aven, a financial services and fintech company. Your role is to provide helpful, accurate, and trustworthy information about Aven's products, services, and company to customers and prospective customers.

Core Guidelines:

1. Answer Based on Provided Data
- ONLY answer questions using information from the context data provided to you
- If the provided context doesn't contain sufficient information to answer a question, clearly state: "I don't have enough information in my current knowledge base to answer that question accurately. For the most up-to-date information, please contact Aven customer support or visit our website."
- Never make up or infer information that isn't explicitly stated in the provided context

2. Tone and Voice
- Professional yet approachable: Sound knowledgeable but not overly technical
- Helpful and customer-focused: Prioritize solving the user's problem or answering their question
- Trustworthy: Be transparent about limitations and always provide accurate information
- Concise but complete: Give thorough answers without being unnecessarily verbose

3. Response Structure
For each response:
1. Start with a clear, direct answer to the user's question
2. Provide relevant context and details from the provided data
3. Suggest relevant actions the user can take (when appropriate)

Remember: You represent Aven - be professional, helpful, and accurate. Use only the information provided in your knowledge base."""

        # get response from Groq
        print(">>> Getting response from Groq...")
        try:
            res = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": augmented_query}
                ],
                max_tokens=1000,
                temperature=0.1
            )
            print(">>> Got response from Groq")
            return res.choices[0].message.content, sources[:5]  # return top 5 sources
            
        except Exception as e:
            print(f">>> Groq API error: {e}")
            # check if it's a 403 error specifically
            if "403" in str(e) or "Access denied" in str(e):
                raise HTTPException(status_code=500, detail="API access denied. Please check your Groq API key and account status.")
            else:
                raise HTTPException(status_code=500, detail=f"AI model error: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        print(f">>> Unexpected RAG error: {e}")
        raise



# API endpoint for chat
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process chat message and return AI response"""

    try:
        # validate input
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        # log the incoming request
        print(f">>> Processing chat request: {request.message[:100]}...")
        if request.conversation_id:
            print(f">>> Conversation ID: {request.conversation_id}")
        
        # perform RAG query
        start_time = time.time()
        ai_response, sources = perform_rag(request.message.strip())
        processing_time = time.time() - start_time
        
        # validate sources and convert to proper format
        validated_sources = []
        aven_source_count = 0
        
        for source in sources:
            try:
                # ensure all required fields are present
                source_info = SourceInfo(
                    source=source.get('source', ''),
                    title=source.get('title', 'Unknown'),
                    score=source.get('score', 0.0),
                    domain=source.get('domain', 'unknown'),
                    verified_aven=source.get('verified_aven', False),
                    crawl_method=source.get('crawl_method'),
                    source_type=source.get('source_type'),
                    is_aven_domain=source.get('is_aven_domain', False)
                )
                
                validated_sources.append(source_info)
                
                if source_info.is_aven_domain:
                    aven_source_count += 1
                    
            except Exception as e:
                print(f">>>  Error validating source: {e}")
                continue
        
        # log success metrics
        print(f">>> Response generated in {processing_time:.2f}s")
        print(f">>> Sources: {aven_source_count}/{len(validated_sources)} from Aven")
        print(f">>> Response length: {len(ai_response)} characters")
        
        # return the response
        return ChatResponse(
            response=ai_response,
            conversation_id=request.conversation_id,
            sources=validated_sources
        )
        
    except HTTPException:
        # re-raise HTTP exceptions (like validation errors)
        raise
    except Exception as e:
        # log unexpected errors
        print(f">>> Unexpected chat error: {e}")
        raise HTTPException(
            status_code=500, 
            detail="An unexpected error occurred while processing your request. Please try again."
        )



# run the FastAPI app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)