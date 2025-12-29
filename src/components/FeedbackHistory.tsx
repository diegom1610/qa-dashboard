import { useState } from 'react';
import { Star, Trash2, Edit, Save, X, Clock } from 'lucide-react';
import { useFeedback } from '../hooks/useFeedback';
import { useAuth } from '../contexts/AuthContext';
import { FeedbackComments } from './FeedbackComments';
import type { HumanFeedback } from '../types/database';

interface FeedbackHistoryProps {
  conversationId: string;
}

const RATING_CATEGORIES = [
  { id: 'logic_path', label: 'Logic Path' },
  { id: 'information', label: 'Information' },
  { id: 'solution', label: 'Solution' },
  { id: 'communication', label: 'Communication' },
  { id: 'language_usage', label: 'Language Usage' },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  tone: 'Tone & Empathy',
  accuracy: 'Accuracy',
  efficiency: 'Efficiency',
  knowledge: 'Product Knowledge',
  resolution: 'Problem Resolution',
  communication: 'Communication Skills',
  logic_path: 'Logic Path',
  information: 'Information',
  solution: 'Solution',
  language_usage: 'Language Usage',
};

export function FeedbackHistory({ conversationId }: FeedbackHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoryScores, setEditCategoryScores] = useState({
    logic_path: 0,
    information: 0,
    solution: 0,
    communication: 0,
    language_usage: 0,
  });
  const [editText, setEditText] = useState('');

  const { feedback, loading, updateFeedback, deleteFeedback } =
    useFeedback(conversationId);
  const { user } = useAuth();

  const startEditing = (item: HumanFeedback) => {
    setEditingId(item.id);
    setEditCategoryScores({
      logic_path: item.logic_path_score || 0,
      information: item.information_score || 0,
      solution: item.solution_score || 0,
      communication: item.communication_score || 0,
      language_usage: item.language_usage_score || 0,
    });
    setEditText(item.feedback_text || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditCategoryScores({
      logic_path: 0,
      information: 0,
      solution: 0,
      communication: 0,
      language_usage: 0,
    });
    setEditText('');
  };

  const setCategoryScore = (categoryId: keyof typeof editCategoryScores, score: number) => {
    setEditCategoryScores((prev) => ({
      ...prev,
      [categoryId]: score,
    }));
  };

  const saveEdit = async (id: string) => {
    const totalStars = Object.values(editCategoryScores).reduce((sum, score) => sum + score, 0);

    if (totalStars === 0) {
      alert('Please rate at least one category above 0');
      return;
    }

    try {
      await updateFeedback(id, {
        rating: totalStars,
        feedback_text: editText.trim() || null,
        categories: Object.keys(editCategoryScores).filter(
          (key) => editCategoryScores[key as keyof typeof editCategoryScores] > 0
        ),
        logic_path: editCategoryScores.logic_path > 0,
        information: editCategoryScores.information > 0,
        solution: editCategoryScores.solution > 0,
        communication: editCategoryScores.communication > 0,
        language_usage: editCategoryScores.language_usage > 0,
        logic_path_score: editCategoryScores.logic_path,
        information_score: editCategoryScores.information,
        solution_score: editCategoryScores.solution,
        communication_score: editCategoryScores.communication,
        language_usage_score: editCategoryScores.language_usage,
      });
      cancelEditing();
    } catch (error) {
      console.error('Failed to update feedback:', error);
      alert('Failed to update feedback. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this feedback?')) {
      try {
        await deleteFeedback(id);
      } catch (error) {
        console.error('Failed to delete feedback:', error);
        alert('Failed to delete feedback. Please try again.');
      }
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getActiveCategoriesFromFeedback = (item: HumanFeedback): Array<{ id: string; score: number }> => {
    const categories: Array<{ id: string; score: number }> = [];
    if (item.logic_path_score > 0) categories.push({ id: 'logic_path', score: item.logic_path_score });
    if (item.information_score > 0) categories.push({ id: 'information', score: item.information_score });
    if (item.solution_score > 0) categories.push({ id: 'solution', score: item.solution_score });
    if (item.communication_score > 0) categories.push({ id: 'communication', score: item.communication_score });
    if (item.language_usage_score > 0) categories.push({ id: 'language_usage', score: item.language_usage_score });

    return categories;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-slate-600">Loading feedback...</span>
        </div>
      </div>
    );
  }

  if (feedback.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
        <p className="text-slate-600">
          No feedback yet. Be the first to review this conversation!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-slate-700">
        Previous Reviews ({feedback.length})
      </h4>
      {feedback.map((item) => {
        const isEditing = editingId === item.id;
        const isOwnFeedback = user?.id === item.reviewer_id;
        const activeCategories = getActiveCategoriesFromFeedback(item);
        const editTotalStars = Object.values(editCategoryScores).filter(Boolean).length;

        return (
          <div
            key={item.id}
            className="bg-white rounded-lg border border-slate-200 p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-900">
                  {item.reviewer_name}
                </span>

                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= (isEditing ? editTotalStars : item.rating)
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-slate-300'
                      }`}
                    />
                  ))}
                </div>

                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(item.created_at)}
                  {item.updated_at !== item.created_at && ' (edited)'}
                </span>
              </div>

              {isOwnFeedback && !isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditing(item)}
                    className="text-slate-600 hover:text-blue-600 transition"
                    title="Edit feedback"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-slate-600 hover:text-red-600 transition"
                    title="Delete feedback"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(item.id)}
                    className="text-green-600 hover:text-green-700 transition"
                    title="Save changes"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="text-slate-600 hover:text-slate-700 transition"
                    title="Cancel editing"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3 mb-3">
                <p className="text-xs text-slate-500 mb-3">
                  Rate each category from 0 to 4 stars:
                </p>
                {RATING_CATEGORIES.map((category) => (
                  <div
                    key={category.id}
                    className="p-3 border-2 border-slate-200 rounded-lg hover:border-slate-300 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-900">{category.label}</span>
                      <span className="text-sm font-semibold text-slate-700">
                        {editCategoryScores[category.id as keyof typeof editCategoryScores]} / 4
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4].map((starValue) => (
                        <button
                          key={starValue}
                          type="button"
                          onClick={() => setCategoryScore(category.id as keyof typeof editCategoryScores, starValue)}
                          className="transition"
                          title={`${starValue} stars`}
                        >
                          <Star
                            className={`w-6 h-6 ${
                              starValue === 0 && editCategoryScores[category.id as keyof typeof editCategoryScores] > 0
                                ? 'text-yellow-500 fill-yellow-500'
                                : starValue > 0 && starValue <= editCategoryScores[category.id as keyof typeof editCategoryScores]
                                ? 'text-yellow-500 fill-yellow-500'
                                : starValue === 0 && editCategoryScores[category.id as keyof typeof editCategoryScores] === 0
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
            ) : (
              <div className="flex flex-wrap gap-2 mb-3">
                {activeCategories.map((category) => (
                  <span
                    key={category.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded"
                  >
                    {CATEGORY_LABELS[category.id] || category.id}
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: category.score }, (_, i) => (
                        <Star key={i} className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      ))}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {isEditing ? (
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                placeholder="Add detailed feedback..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
              />
            ) : (
              <>
                {item.feedback_text && (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap mb-3">
                    {item.feedback_text}
                  </p>
                )}

                <FeedbackComments
                  feedbackId={item.id}
                  conversationId={item.conversation_id}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
