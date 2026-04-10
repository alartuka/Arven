export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
}

export interface Source {
  source: string;
  title: string;
  score: number;
  domain: string;
  verified_aven: boolean;
  crawl_method?: string;
  source_type?: string;
  is_aven_domain: boolean;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  response: string;
  conversation_id?: string;
  sources?: Source[];
}

class RAGClient {
  private baseURL: string;

  constructor(baseURL = process.env.NEXT_PUBLIC_RAG_API_URL!) {
    this.baseURL = baseURL;
  }

  async sendMessage(message: string, conversationId?: string): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseURL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('RAG API Error:', error);
      throw error;
    }
  }
}

export const ragClient = new RAGClient();