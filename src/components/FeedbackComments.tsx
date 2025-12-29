import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, AtSign, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Comment {
  id: string;
  feedback_id: string;
  conversation_id: string;
  commenter_id: string;
  commenter_name: string;
  commenter_role: 'evaluator' | 'agent' | 'admin';
  comment_text: string;
  created_at: string;
  updated_at: string;
}

interface UserSuggestion {
  id: string;
  email: string;
  role: string;
}

interface FeedbackCommentsProps {
  feedbackId: string;
  conversationId: string;
}

export function FeedbackComments({ feedbackId, conversationId }: FeedbackCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [userRole, setUserRole] = useState<string>('agent');

  useEffect(() => {
    fetchComments();
    fetchUserRole();

    const channel = supabase
      .channel('feedback_comments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feedback_comments',
          filter: `feedback_id=eq.${feedbackId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [feedbackId]);

  const fetchUserRole = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_settings')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    setUserRole(data?.role || 'agent');
  };

  const fetchComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('feedback_comments')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (search: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, email, role');

      if (error) {
        console.error('Error fetching users from view:', error);
        return;
      }

      if (data) {
        const filtered = search
          ? data.filter((u) => u.email?.toLowerCase().includes(search.toLowerCase()))
          : data;

        setUserSuggestions(
          filtered.slice(0, 10).map((u) => ({
            id: u.id,
            email: u.email || '',
            role: u.role || 'agent',
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart;
    setNewComment(text);
    setCursorPosition(cursor);

    const textBeforeCursor = text.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      const searchTerm = textBeforeCursor.slice(atIndex + 1);
      if (!searchTerm.includes(' ')) {
        setMentionSearch(searchTerm);
        setShowMentions(true);
        fetchUsers(searchTerm);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (email: string) => {
    const textBeforeCursor = newComment.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = newComment.slice(cursorPosition);

    const newText = newComment.slice(0, atIndex) + `@${email} ` + textAfterCursor;
    setNewComment(newText);
    setShowMentions(false);

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = atIndex + email.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@([\w.-]+@[\w.-]+\.\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const { data: commentData, error: commentError } = await supabase
        .from('feedback_comments')
        .insert({
          feedback_id: feedbackId,
          conversation_id: conversationId,
          commenter_id: user.id,
          commenter_name: user.email || 'Unknown',
          commenter_role: userRole,
          comment_text: newComment.trim(),
        })
        .select()
        .single();

      if (commentError) throw commentError;

      const mentions = extractMentions(newComment);

      if (mentions.length > 0 && commentData) {
        const { data: allUsers } = await supabase
          .from('user_roles')
          .select('id, email');

        if (allUsers) {
          const mentionedUsers = allUsers.filter((u) =>
            mentions.includes(u.email || '')
          );

          if (mentionedUsers.length > 0) {
            const mentionInserts = mentionedUsers.map((u) => ({
              comment_id: commentData.id,
              mentioned_user_id: u.id,
              mentioned_user_email: u.email || '',
            }));

            await supabase.from('comment_mentions').insert(mentionInserts);

            await supabase.functions.invoke('send-comment-notification', {
              body: {
                comment_id: commentData.id,
                mentions: mentionedUsers.map((u) => ({
                  email: u.email,
                  user_id: u.id,
                })),
                comment_text: newComment.trim(),
                commenter_name: user.email,
                conversation_id: conversationId,
              },
            });
          }
        }
      }

      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to submit comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'evaluator':
        return 'bg-blue-100 text-blue-700';
      case 'admin':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-slate-600" />
        <h4 className="text-sm font-semibold text-slate-900">
          Discussion ({comments.length})
        </h4>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <>
          {comments.length > 0 && (
            <div className="space-y-3 mb-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-slate-50 rounded-lg p-3 border border-slate-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {comment.commenter_name}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${getRoleBadgeColor(
                              comment.commenter_role
                            )}`}
                          >
                            {comment.commenter_role}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatTimestamp(comment.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap ml-9">
                    {comment.comment_text}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={handleTextChange}
              placeholder="Add a comment... Use @ to mention someone"
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none text-sm"
            />

            {showMentions && userSuggestions.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                {userSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => insertMention(suggestion.email)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-sm"
                  >
                    <AtSign className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-900">
                      {suggestion.email}
                    </span>
                    <span
                      className={`ml-auto px-2 py-0.5 text-xs font-medium rounded ${getRoleBadgeColor(
                        suggestion.role
                      )}`}
                    >
                      {suggestion.role}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-slate-500">
                <AtSign className="w-3 h-3 inline mr-1" />
                Type @ to mention someone
              </p>
              <button
                onClick={handleSubmit}
                disabled={submitting || !newComment.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition text-sm font-medium"
              >
                {submitting ? (
                  'Sending...'
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
