import { useState, FormEvent } from 'react';
import { Star, CheckCircle, AlertCircle, Send, Lock } from 'lucide-react';
import { useFeedback } from '../hooks/useFeedback';
import { useAuth } from '../contexts/AuthContext';

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

  const { submitFeedback, feedback } = useFeedback(conversationId);
  const { user } = useAuth();

  const userHasRated = feedback.some((f) => f.reviewer_id === user?.id);
  const userFeedback = feedback.find((f) => f.reviewer_id === user?.id);

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

      await submitFeedback({
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
