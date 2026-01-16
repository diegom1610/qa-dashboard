import { useState, useEffect } from 'react';
import { User, Bot, Clock, Tag, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  part_id: string;
  part_type: string;
  author_type: string;
  author_name: string;
  body: string;
  created_at: string;
  is_note: boolean;
  attachments: any[];
}

interface ConversationThread {
  conversation_id: string;
  state: string;
  subject: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  tags: string[];
  priority: string;
  messages: Message[];
  cached?: boolean;
}

interface ConversationViewerProps {
  conversationId: string | null;
}

export function ConversationViewer({ conversationId }: ConversationViewerProps) {
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    } else {
      setThread(null);
    }
  }, [conversationId]);

  const loadConversation = async (convId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-conversation-thread`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversation_id: convId })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setThread(data);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 text-sm">
            Select a conversation to view the message thread
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-slate-600 text-sm">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium mb-2">Failed to load conversation</p>
          <p className="text-slate-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => loadConversation(conversationId)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!thread) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'open':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'snoozed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="border-b border-slate-200 p-4 bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
              ID: {thread.conversation_id}
            </span>
            <a
              href={`https://app.intercom.com/a/inbox/all/conversation/${thread.conversation_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
              title="Open in Intercom"
            >
              <ExternalLink className="w-3 h-3" />
              Open in Intercom
            </a>
          </div>
          <div className="flex items-center gap-2">
            {thread.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                Cached
              </span>
            )}
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStateColor(
                thread.state
              )}`}
            >
              {thread.state}
            </span>
          </div>
        </div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              {thread.subject}
            </h2>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{thread.customer_name}</span>
              </div>
              {thread.customer_email && (
                <span className="text-slate-400">•</span>
              )}
              {thread.customer_email && (
                <span>{thread.customer_email}</span>
              )}
            </div>
          </div>
        </div>

        {thread.tags && thread.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-3 h-3 text-slate-400" />
            {thread.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {thread.messages.map((message) => {
          const isAgent = message.author_type === 'admin' || message.author_type === 'bot';
          const isNote = message.is_note;

          if (isNote) {
            return (
              <div key={message.part_id} className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-xs font-medium text-yellow-800">
                    Internal Note
                  </span>
                  <span className="text-xs text-yellow-600">•</span>
                  <span className="text-xs text-yellow-600">
                    {message.author_name}
                  </span>
                  <span className="text-xs text-yellow-600">•</span>
                  <span className="text-xs text-yellow-600">
                    {formatDate(message.created_at)}
                  </span>
                </div>
                <div
                  className="text-sm text-yellow-900"
                  dangerouslySetInnerHTML={{ __html: message.body }}
                />
              </div>
            );
          }

          return (
            <div
              key={message.part_id}
              className={`flex gap-3 ${isAgent ? '' : 'flex-row-reverse'}`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  isAgent ? 'bg-blue-100' : 'bg-slate-100'
                }`}
              >
                {isAgent ? (
                  <Bot className="w-4 h-4 text-blue-600" />
                ) : (
                  <User className="w-4 h-4 text-slate-600" />
                )}
              </div>

              <div className={`flex-1 max-w-2xl ${isAgent ? '' : 'flex flex-col items-end'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-900">
                    {message.author_name}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    {formatDate(message.created_at)}
                  </div>
                </div>

                <div
                  className={`rounded-lg p-3 ${
                    isAgent
                      ? 'bg-blue-50 text-slate-900'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  <div
                    className="text-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: message.body }}
                  />

                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Attachments:</p>
                      {message.attachments.map((att: any, idx: number) => (
                        <div key={idx} className="text-xs text-blue-600 hover:underline">
                          {att.name || `Attachment ${idx + 1}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {thread.messages.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            No messages in this conversation
          </div>
        )}
      </div>
    </div>
  );
}
