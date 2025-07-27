from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from langchain_pinecone import PineconeVectorStore
from langchain_community.embeddings import HuggingFaceEmbeddings
from groq import Groq
from pinecone import Pinecone

# load environment variables
load_dotenv()

app = FastAPI(title="Arven API", version="1.0.0")

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # needs adjustment to the vercel/frontend URL?
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# initialize clients and models
try:
    # initialize embeddings
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    # initialize Groq client
    groq_client = Groq(api_key=os.getenv('GROQ_API_KEY'))
    
    # initialize Pinecone
    pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
    index_name = "arven"
    namespace = "company-documents"
    pinecone_index = pc.Index(index_name)
    
    print("All services initialized successfully")
    
except Exception as e:
    print(f"Initialization error: {e}")
    raise

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: Optional[str] = None
    sources: Optional[list] = None

# system prompt for Groq
system_prompt = """
    You are Aven's customer service AI assistant. You help customers with questions about Aven Card, which is a financial services product that helps users build credit and manage their finances.

    Your role is to:
        - Provide helpful, accurate information about Aven Card features and services
        - Guide customers through common processes and troubleshooting
        - Maintain a friendly, professional, and supportive tone
        - Use the provided context from Aven's official documentation and website
        - If you don't know something specific, direct customers to contact Aven support directly

    Always prioritize customer satisfaction and provide clear, actionable responses based on the retrieved information about Aven.
    If you cannot find an answer in the provided context, politely inform the user that you are unable to assist with that specific question.
    Remember to use the context provided in the <CONTEXT> tags to inform your responses.
"""

        
def get_huggingface_embeddings(text, model_name="sentence-transformers/all-MiniLM-L6-v2"):
    """Get embeddings for text using HuggingFace model"""
    model = SentenceTransformer(model_name)
    return model.encode(text)

def perform_rag(query: str):
    """Perform RAG query and return response"""
    try:
        # get query embedding
        raw_query_embedding = get_huggingface_embeddings(query)
        query_embedding = np.array(raw_query_embedding)

        # query Pinecone
        top_matches = pinecone_index.query(
            vector=query_embedding.tolist(), 
            top_k=5, # top 5 matches
            include_metadata=True, 
            namespace=namespace
        )

        # extract contexts and sources
        contexts = []
        sources = []
        
        for item in top_matches['matches']:
            if 'text' in item['metadata']:
                contexts.append(item['metadata']['text'])
            elif 'page_content' in item['metadata']:
                contexts.append(item['metadata']['page_content'])
            
            # extract source information
            source_info = {
                'source': item['metadata'].get('source', 'Unknown'),
                'title': item['metadata'].get('title', 'Unknown'),
                'score': item['score']
            }
            sources.append(source_info)

        # create augmented query
        augmented_query = "<CONTEXT>\n" + "\n\n-------\n\n".join(contexts[:10]) + "\n-------\n</CONTEXT>\n\n\n\nMY QUESTION:\n" + query

    
        # get response from Groq
        res = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": augmented_query}
            ]
        )

        return res.choices[0].message.content, sources

    except Exception as e:
        print(f"+++ RAG error!: {e}")
        raise HTTPException(status_code=500, detail=f"RAG processing error: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Arven API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Arven API"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process chat message and return AI response"""
    try:
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        # perform RAG
        response, sources = perform_rag(request.message)
        
        return ChatResponse(
            response=response,
            conversation_id=request.conversation_id,
            sources=sources[:3]  # return top 3 sources
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)