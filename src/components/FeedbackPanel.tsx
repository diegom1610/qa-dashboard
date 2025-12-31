import { useState, FormEvent, useEffect, useRef } from 'react';
import { Star, CheckCircle, AlertCircle, Send, Lock, Shield, AtSign } from 'lucide-react';
import { useFeedback } from '../hooks/useFeedback';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface UserSuggestion {
  id: string;
  email: string;
  role: string;
}

interface FeedbackPanelProps {
  conversationId: string;
  agentName: string;
  onFeedbackSubmitted?: () => void;
}

const RATING_CATEGORIES = [
  { id: 'logic_path', label: 'Logic Path', description: 'Following structured problem-solving approach', min: 0, max: 4 },
  { id: 'information', label: 'Information', description: 'Providing accurate and complete information', min: 0, max: 4 },
  { id: 'solution', label: 'Solution', description: 'Effective problem resolution', min: 0, max: 4 },
  { id: 'communication', label: 'Communication', description: 'Clear and professional communication', min: 0, max: 4 },
  { id: 'language_usage', label: 'Language Usage', description: 'Proper grammar and tone', min: 0, max: 4 },
] as const;

export function FeedbackPanel({
  conversationId,
  agentName,
  onFeedbackSubmitted,
}: FeedbackPanelProps) {
  const [categoryScores, setCategoryScores] = useState<{
    logic_path: number;
    information: number;
    solution: number;
    communication: number;
    language_usage: number;
  }>({
    logic_path: 0,
    information: 0,
    solution: 0,
    communication: 0,
    language_usage: 0,
  });
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [userRole, setUserRole] = useState<string>('agent');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { submitFeedback, feedback } = useFeedback(conversationId);
  const { user } = useAuth();

  const userHasRated = feedback.some((f) => f.reviewer_id === user?.id);
  const userFeedback = feedback.find((f) => f.reviewer_id === user?.id);

  useEffect(() => {
    fetchUserRole();
  }, [user]);

  const fetchUserRole = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_settings')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    setUserRole(data?.role || 'agent');
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

  const handleFeedbackTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart;
    setFeedbackText(text);
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
    const textBeforeCursor = feedbackText.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = feedbackText.slice(cursorPosition);

    const newText = feedbackText.slice(0, atIndex) + `@${email} ` + textAfterCursor;
    setFeedbackText(newText);
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

  const getAgentEmailFromConversation = async (convId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('conversation_threads')
        .select('agent_name')
        .eq('conversation_id', convId)
        .maybeSingle();

      if (error || !data) return null;
      return data.agent_name;
    } catch (error) {
      console.error('Error fetching agent email:', error);
      return null;
    }
  };

  const totalStars = Object.values(categoryScores).reduce((sum, score) => sum + score, 0);

  const setCategoryScore = (categoryId: keyof typeof categoryScores, score: number) => {
    setCategoryScores((prev) => ({
      ...prev,
      [categoryId]: score,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitStatus('idle');
    setErrorMessage('');

    if (totalStars === 0) {
      setSubmitStatus('error');
      setErrorMessage('Please rate at least one category above 0');
      return;
    }

    setIsSubmitting(true);

    try {
      const ratedCategories = Object.keys(categoryScores).filter(
        (key) => categoryScores[key as keyof typeof categoryScores] > 0
      );

      const feedbackData = await submitFeedback({
        conversation_id: conversationId,
        rating: totalStars,
        feedback_text: feedbackText.trim() || null,
        categories: ratedCategories,
        logic_path: categoryScores.logic_path > 0,
        information: categoryScores.information > 0,
        solution: categoryScores.solution > 0,
        communication: categoryScores.communication > 0,
        language_usage: categoryScores.language_usage > 0,
        logic_path_score: categoryScores.logic_path,
        information_score: categoryScores.information,
        solution_score: categoryScores.solution,
        communication_score: categoryScores.communication,
        language_usage_score: categoryScores.language_usage,
      });

      const agentEmail = await getAgentEmailFromConversation(conversationId);
      if (agentEmail) {
        try {
          await supabase.functions.invoke('send-feedback-notification', {
            body: {
              agent_email: agentEmail,
              reviewer_email: user.email,
              rating: totalStars,
              feedback_text: feedbackText.trim() || null,
              conversation_id: conversationId,
            },
          });
        } catch (notifError) {
          console.error('Failed to send feedback notification:', notifError);
        }
      }

      const mentions = extractMentions(feedbackText);

      if (mentions.length > 0 && feedbackData) {
        const { data: allUsers } = await supabase
          .from('user_roles')
          .select('id, email');

        if (allUsers) {
          const mentionedUsers = allUsers.filter((u) =>
            mentions.includes(u.email || '')
          );

          if (mentionedUsers.length > 0) {
            const feedbackCommentData = {
              feedback_id: feedbackData.id,
              conversation_id: conversationId,
              commenter_id: user.id,
              commenter_name: user.email || 'Unknown',
              commenter_role: userRole,
              comment_text: feedbackText.trim(),
            };

            const { data: commentData, error: commentError } = await supabase
              .from('feedback_comments')
              .insert(feedbackCommentData)
              .select()
              .single();

            if (!commentError && commentData) {
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
                  comment_text: feedbackText.trim(),
                  commenter_name: user.email,
                  conversation_id: conversationId,
                },
              });
            }
          }
        }
      }

      setSubmitStatus('success');
      setCategoryScores({
        logic_path: 0,
        information: 0,
        solution: 0,
        communication: 0,
        language_usage: 0,
      });
      setFeedbackText('');

      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }

      setTimeout(() => {
        setSubmitStatus('idle');
      }, 3000);
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to submit feedback'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmitFeedback = userRole === 'evaluator' || userRole === 'admin';

  if (!canSubmitFeedback) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-yellow-900 mb-1">
              Evaluator Access Required
            </h4>
            <p className="text-sm text-yellow-800">
              Only evaluators and administrators can submit feedback evaluations.
              You can view existing feedback and add comments below.
            </p>
            <p className="text-xs text-yellow-700 mt-2">
              Current role: <strong className="capitalize">{userRole}</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (userHasRated && userFeedback) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-yellow-100 p-2 rounded-full">
            <Lock className="w-5 h-5 text-yellow-700" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-yellow-900">
              Conversation Already Rated
            </h3>
            <p className="text-sm text-yellow-700">
              You submitted feedback on {new Date(userFeedback.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 mb-4 border border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-slate-700">Your Score:</span>
            <span className="text-lg font-bold text-slate-900">{((userFeedback.rating / 20) * 100).toFixed(1)}%</span>
            <span className="text-sm text-slate-600">({userFeedback.rating}/20 stars)</span>
          </div>
          {userFeedback.feedback_text && (
            <p className="text-sm text-slate-600 mt-2">{userFeedback.feedback_text}</p>
          )}
        </div>

        <div className="bg-yellow-100 rounded-lg p-4 border border-yellow-300">
          <p className="text-sm text-yellow-800 mb-2">
            <strong>Note:</strong> To prevent duplicate ratings and maintain data integrity,
            each conversation can only be rated once per reviewer.
          </p>
          <p className="text-sm text-yellow-700">
            You can edit your existing feedback by clicking the edit button in the "Previous Reviews" section above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        Add Review for {agentName}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-slate-700">
              Rating Categories <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900">
                {totalStars}
              </span>
              <span className="text-sm font-medium text-slate-600">
                / 20 stars
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Rate each category from 0 to 4 stars. Total score is the sum of all categories (max 20).
          </p>

          <div className="space-y-4">
            {RATING_CATEGORIES.map((category) => (
              <div
                key={category.id}
                className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-300 transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-slate-900">{category.label}</span>
                    <p className="text-xs text-slate-600 mt-0.5">{category.description}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 ml-2">
                    {categoryScores[category.id as keyof typeof categoryScores]} / 4
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  {[0, 1, 2, 3, 4].map((starValue) => (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => setCategoryScore(category.id as keyof typeof categoryScores, starValue)}
                      className="transition"
                      title={`${starValue} stars`}
                    >
                      <Star
                        className={`w-6 h-6 ${
                          starValue === 0 && categoryScores[category.id as keyof typeof categoryScores] > 0
                            ? 'text-yellow-500 fill-yellow-500'
                            : starValue > 0 && starValue <= categoryScores[category.id as keyof typeof categoryScores]
                            ? 'text-yellow-500 fill-yellow-500'
                            : starValue === 0 && categoryScores[category.id as keyof typeof categoryScores] === 0
                            ? 'text-red-400 fill-red-400'
                            : 'text-slate-300 hover:text-slate-400'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="feedbackText"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Detailed Feedback (Optional)
          </label>
          <div className="relative">
            <textarea
              ref={textareaRef}
              id="feedbackText"
              value={feedbackText}
              onChange={handleFeedbackTextChange}
              rows={4}
              placeholder="Provide specific examples and context... Use @ to mention someone"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
            />

            {showMentions && userSuggestions.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                {userSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => insertMention(suggestion.email)}
                    type="button"
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
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-slate-500">
              <AtSign className="w-3 h-3 inline mr-1" />
              Type @ to mention someone
            </p>
            <p className="text-xs text-slate-500">
              {feedbackText.length} / 1000 characters
            </p>
          </div>
        </div>

        {submitStatus === 'success' && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Feedback submitted successfully!</span>
          </div>
        )}

        {submitStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Feedback</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
