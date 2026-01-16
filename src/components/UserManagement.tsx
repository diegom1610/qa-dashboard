import { useState, useEffect } from 'react';
import { Users, Shield, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  email: string;
  role: string;
  timezone: string | null;
}

interface Group {
  id: string;
  name: string;
  display_name: string;
}

interface UserGroupMapping {
  [userId: string]: string[];
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [userGroupMappings, setUserGroupMappings] = useState<UserGroupMapping>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [usersResult, groupsResult, mappingsResult] = await Promise.all([
        supabase.from('user_roles').select('id, email, role, timezone').order('email', { ascending: true }),
        supabase.from('agent_groups').select('id, name, display_name').eq('active', true).order('display_name'),
        supabase.from('agent_group_mapping').select('agent_id, group_id')
      ]);

      if (usersResult.error) throw usersResult.error;
      if (groupsResult.error) throw groupsResult.error;
      if (mappingsResult.error) throw mappingsResult.error;

      setUsers(usersResult.data || []);
      setGroups(groupsResult.data || []);

      const mappings: UserGroupMapping = {};
      (mappingsResult.data || []).forEach(mapping => {
        if (!mappings[mapping.agent_id]) {
          mappings[mapping.agent_id] = [];
        }
        mappings[mapping.agent_id].push(mapping.group_id);
      });
      setUserGroupMappings(mappings);

    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === currentUser?.id) {
      setMessage({
        type: 'error',
        text: 'Cannot change your own role. Use the Settings panel instead.',
      });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    setUpdating(userId);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            role: newRole,
            timezone: 'UTC',
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        );

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );

      const userEmail = users.find((u) => u.id === userId)?.email;
      setMessage({
        type: 'success',
        text: `Role updated: ${userEmail} is now ${newRole}`,
      });

      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error updating role:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update role',
      });
      setTimeout(() => setMessage(null), 5000);
      await fetchData();
    } finally {
      setUpdating(null);
    }
  };

  const handleGroupChange = async (userId: string, groupId: string, isAssigned: boolean) => {
    setUpdating(userId);
    setMessage(null);

    try {
      if (isAssigned) {
        const { error } = await supabase.from('agent_group_mapping').delete().eq('agent_id', userId).eq('group_id', groupId);
        if (error) throw error;

        setUserGroupMappings(prev => ({
          ...prev,
          [userId]: (prev[userId] || []).filter(g => g !== groupId)
        }));
      } else {
        const { error } = await supabase.from('agent_group_mapping').insert({ agent_id: userId, group_id: groupId });
        if (error) throw error;

        setUserGroupMappings(prev => ({
          ...prev,
          [userId]: [...(prev[userId] || []), groupId]
        }));
      }

      const userEmail = users.find(u => u.id === userId)?.email;
      const groupName = groups.find(g => g.id === groupId)?.display_name;
      setMessage({
        type: 'success',
        text: `${userEmail} ${isAssigned ? 'removed from' : 'added to'} ${groupName}`,
      });

      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error updating group assignment:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update group assignment',
      });
      setTimeout(() => setMessage(null), 5000);
      await fetchData();
    } finally {
      setUpdating(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'evaluator':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">User Management</h3>
            <p className="text-sm text-slate-600">Manage user roles and permissions</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">About Roles</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li><strong>Agents:</strong> Can view feedback and comment on evaluations</li>
              <li><strong>Evaluators:</strong> Can submit feedback evaluations</li>
              <li><strong>Admins:</strong> Full access including user management</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">
                Email
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">
                Current Role
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">
                Change Role
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">
                Timezone
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">
                Group Assignment
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-900 font-medium">
                      {user.email}
                    </span>
                    {user.id === currentUser?.id && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-block px-3 py-1 text-xs font-medium rounded border ${getRoleBadgeColor(
                      user.role
                    )}`}
                  >
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {user.id === currentUser?.id ? (
                    <span className="text-xs text-slate-500 italic">
                      Use Settings panel
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={updating === user.id}
                        className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-slate-100 disabled:cursor-not-allowed"
                      >
                        <option value="agent">Agent</option>
                        <option value="evaluator">Evaluator</option>
                        <option value="admin">Administrator</option>
                      </select>
                      {updating === user.id && (
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      )}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-slate-600">
                    {user.timezone || 'UTC'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-2">
                    {groups.map(group => {
                      const isAssigned = (userGroupMappings[user.id] || []).includes(group.id);
                      return (
                        <button
                          key={group.id}
                          onClick={() => handleGroupChange(user.id, group.id, isAssigned)}
                          disabled={updating === user.id}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                            isAssigned
                              ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {group.display_name} {isAssigned ? '✓' : '+'}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No users found</p>
        </div>
      )}
    </div>
  );
}
