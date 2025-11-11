import { useState, type FormEvent } from 'react';
import { Star, Send, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import { useFeedback } from '../hooks/useFeedback';
import { useAuth } from '../contexts/AuthContext';

interface FeedbackPanelProps {
  conversationId: string;
  agentName: string;
}

const RATING_CATEGORIES = [
  { id: 'logic_path', label: 'Logic Path', description: 'Clear and logical conversation flow' },
  { id: 'information', label: 'Information', description: 'Accurate and complete information' },
  { id: 'solution', label: 'Solution', description: 'Effective problem resolution' },
  { id: 'communication', label: 'Communication', description: 'Clear and professional communication' },
  { id: 'language_usage', label: 'Language Usage', description: 'Proper grammar and tone' },
] as const;

export function FeedbackPanel({
  conversationId,
  agentName,
}: FeedbackPanelProps) {
  const [categoryScores, setCategoryScores] = useState({
    logic_path: false,
    information: false,
    solution: false,
    communication: false,
    language_usage: false,
  });
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { submitFeedback, feedback } = useFeedback(conversationId);
  const { user } = useAuth();

  const userHasRated = feedback.some((f) => f.reviewer_id === user?.id);
  const userFeedback = feedback.find((f) => f.reviewer_id === user?.id);

  const totalStars = Object.values(categoryScores).filter(Boolean).length;

  const toggleCategory = (categoryId: keyof typeof categoryScores) => {
    setCategoryScores((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitStatus('idle');
    setErrorMessage('');

    if (totalStars === 0) {
      setSubmitStatus('error');
      setErrorMessage('Please select at least one category');
      return;
    }

    setIsSubmitting(true);

    try {
      await submitFeedback({
        conversation_id: conversationId,
        rating: totalStars,
        feedback_text: feedbackText.trim() || null,
        categories: Object.keys(categoryScores).filter(
          (key) => categoryScores[key as keyof typeof categoryScores]
        ),
        ...categoryScores,
      });

      setSubmitStatus('success');
      setCategoryScores({
        logic_path: false,
        information: false,
        solution: false,
        communication: false,
        language_usage: false,
      });
      setFeedbackText('');

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
            <span className="text-sm font-medium text-slate-700">Your Rating:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= userFeedback.rating
                      ? 'text-yellow-500 fill-yellow-500'
                      : 'text-slate-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-slate-600">({userFeedback.rating}/5)</span>
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
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= totalStars
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-slate-600">
                {totalStars} / 5
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Each selected category adds 1 star to the rating. Select all that apply.
          </p>

          <div className="space-y-3">
            {RATING_CATEGORIES.map((category) => (
              <label
                key={category.id}
                className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                  categoryScores[category.id as keyof typeof categoryScores]
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={categoryScores[category.id as keyof typeof categoryScores]}
                  onChange={() => toggleCategory(category.id as keyof typeof categoryScores)}
                  className="mt-0.5 w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{category.label}</span>
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{category.description}</p>
                </div>
              </label>
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
          <textarea
            id="feedbackText"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={4}
            placeholder="Provide specific examples and context..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
          />
          <p className="text-xs text-slate-500 mt-1">
            {feedbackText.length} / 1000 characters
          </p>
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
