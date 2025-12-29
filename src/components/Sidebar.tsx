import { useState, useEffect } from 'react';
import { X, Settings, Mail, Clock, User, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  // Americas
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Bogota', label: 'Colombia Time (COT, UTC-5)' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST, UTC-6)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT, UTC-3)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART, UTC-3)' },
  // Europe
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  // Asia
  { value: 'Asia/Dubai', label: 'Dubai (GST, UTC+4)' },
  { value: 'Asia/Kolkata', label: 'India (IST, UTC+5:30)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT, UTC+7)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST, UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST, UTC+8)' },
  // Oceania
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
  const [timezone, setTimezone] = useState('UTC');
  const [role, setRole] = useState<'evaluator' | 'agent' | 'admin'>('agent');
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user && isOpen) {
      fetchUserSettings();
    }
  }, [user, isOpen]);

  const fetchUserSettings = async () => {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('timezone, role')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (data) {
        setTimezone(data.timezone || 'UTC');
        setRole(data.role || 'agent');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Check your new email for confirmation link',
      });
      setNewEmail('');
    } catch (error) {
      console.error('Error updating email:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update email',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const updateData: {
        user_id: string;
        timezone: string;
        role?: string;
        updated_at: string;
      } = {
        user_id: user?.id!,
        timezone,
        updated_at: new Date().toISOString(),
      };

      if (role === 'admin') {
        updateData.role = role;
      }

      const { error } = await supabase
        .from('user_settings')
        .upsert(updateData, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Settings updated successfully',
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update settings',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === 'profile'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === 'settings'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {message && (
              <div
                className={`mb-4 p-3 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Current Account
                  </h3>
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {user?.email}
                        </p>
                        <p className="text-xs text-slate-500">Verified Account</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Change Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter new email address"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition mb-2"
                  />
                  <button
                    onClick={handleUpdateEmail}
                    disabled={saving || !newEmail}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition font-medium"
                  >
                    {saving ? 'Updating...' : 'Update Email'}
                  </button>
                  <p className="text-xs text-slate-500 mt-2">
                    You will receive a confirmation email at your new address.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                {role === 'admin' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      <Shield className="w-4 h-4 inline mr-2" />
                      User Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'evaluator' | 'agent' | 'admin')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition mb-2"
                    >
                      <option value="agent">Agent</option>
                      <option value="evaluator">Evaluator</option>
                      <option value="admin">Administrator</option>
                    </select>
                    <p className="text-xs text-slate-500 mb-4">
                      <strong>Evaluators:</strong> Can submit feedback evaluations<br />
                      <strong>Agents:</strong> Can only view and comment on evaluations<br />
                      <strong>Admins:</strong> Full access to all features
                    </p>
                  </div>
                )}

                {role !== 'admin' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-slate-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-1">
                          Current Role: <span className="capitalize text-blue-600">{role}</span>
                        </h4>
                        <p className="text-xs text-slate-600 mb-2">
                          Only administrators can change user roles. Contact your admin if you need a role change.
                        </p>
                        <div className="text-xs text-slate-500">
                          {role === 'evaluator' && '✓ You can submit feedback evaluations'}
                          {role === 'agent' && '✓ You can view and comment on evaluations'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition mb-2"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mb-4">
                    All dashboard times will be displayed in your selected timezone.
                  </p>
                </div>

                <button
                  onClick={handleUpdateSettings}
                  disabled={saving}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition font-medium"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    About Roles
                  </h4>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>Roles control what actions you can perform</li>
                    <li>Only evaluators and admins can submit feedback</li>
                    <li>All users can view and comment</li>
                    <li>Only admins can change user roles</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
