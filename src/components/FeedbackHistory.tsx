import { useState } from 'react';
import { Star, Trash2, Edit, Save, X, Clock } from 'lucide-react';
import { useFeedback } from '../hooks/useFeedback';
import { useAuth } from '../contexts/AuthContext';
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
    logic_path: false,
    information: false,
    solution: false,
    communication: false,
    language_usage: false,
  });
  const [editText, setEditText] = useState('');

  const { feedback, loading, updateFeedback, deleteFeedback } =
    useFeedback(conversationId);
  const { user } = useAuth();

  const startEditing = (item: HumanFeedback) => {
    setEditingId(item.id);
    setEditCategoryScores({
      logic_path: item.logic_path || false,
      information: item.information || false,
      solution: item.solution || false,
      communication: item.communication || false,
      language_usage: item.language_usage || false,
    });
    setEditText(item.feedback_text || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditCategoryScores({
      logic_path: false,
      information: false,
      solution: false,
      communication: false,
      language_usage: false,
    });
    setEditText('');
  };

  const toggleEditCategory = (categoryId: keyof typeof editCategoryScores) => {
    setEditCategoryScores((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const saveEdit = async (id: string) => {
    const totalStars = Object.values(editCategoryScores).filter(Boolean).length;

    if (totalStars === 0) {
      alert('Please select at least one category');
      return;
    }

    try {
      await updateFeedback(id, {
        rating: totalStars,
        feedback_text: editText.trim() || null,
        categories: Object.keys(editCategoryScores).filter(
          (key) => editCategoryScores[key as keyof typeof editCategoryScores]
        ),
        ...editCategoryScores,
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

  const getActiveCategoriesFromFeedback = (item: HumanFeedback): string[] => {
    const categories: string[] = [];
    if (item.logic_path) categories.push('logic_path');
    if (item.information) categories.push('information');
    if (item.solution) categories.push('solution');
    if (item.communication) categories.push('communication');
    if (item.language_usage) categories.push('language_usage');

    if (categories.length === 0 && Array.isArray(item.categories)) {
      return item.categories;
    }

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
                <p className="text-xs text-slate-500">
                  Select categories (each = 1 star):
                </p>
                {RATING_CATEGORIES.map((category) => (
                  <label
                    key={category.id}
                    className={`flex items-center gap-3 p-2 border-2 rounded-lg cursor-pointer transition ${
                      editCategoryScores[category.id as keyof typeof editCategoryScores]
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editCategoryScores[category.id as keyof typeof editCategoryScores]}
                      onChange={() => toggleEditCategory(category.id as keyof typeof editCategoryScores)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{category.label}</span>
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mb-3">
                {activeCategories.map((categoryId: string) => (
                  <span
                    key={categoryId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded"
                  >
                    {CATEGORY_LABELS[categoryId] || categoryId}
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
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
              item.feedback_text && (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {item.feedback_text}
                </p>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
