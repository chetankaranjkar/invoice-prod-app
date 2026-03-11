import React, { useState, useEffect } from 'react';
import { useDateFormat } from '../hooks/useDateFormat';
import { Plus, Edit, Trash2, Users as UsersIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/agent';
import { getApiErrorMessage } from '../utils/helpers';
import { UserInvoicesModal } from '../components/UserInvoicesModal';
import type { UserListDto, CreateUserDto } from '../types';

export const UserManagementPage: React.FC = () => {
  const { themeColors } = useTheme();
  const formatDate = useDateFormat();
  const [users, setUsers] = useState<UserListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListDto | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('User');
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListDto | null>(null);
  const [formData, setFormData] = useState<CreateUserDto>({
    name: '',
    email: '',
    password: '',
    role: 'User',
    businessName: '',
    gstNumber: '',
    address: '',
    bankName: '',
    bankAccountNo: '',
    ifscCode: '',
    panNumber: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
  });

  useEffect(() => {
    loadUsers();
    loadCurrentUserRole();
  }, []);

  const loadCurrentUserRole = async () => {
    try {
      const response = await api.user.getProfile();
      setCurrentUserRole(response.data.role || 'User');
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.userManagement.getAllUsers();
      setUsers(response.data);
      setError('');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to load users'));
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Frontend validation: Check for duplicate email
    if (formData.email) {
      const emailLower = formData.email.toLowerCase().trim();
      const existingUser = users.find(
        u => u.email.toLowerCase().trim() === emailLower && 
        (!editingUser || u.id !== editingUser.id)
      );
      
      if (existingUser) {
        setError(`A user with email '${formData.email}' already exists. Please use a different email address.`);
        return;
      }
    }

    try {
      if (editingUser) {
        await api.userManagement.updateUser(editingUser.id, formData);
      } else {
        await api.userManagement.createUser(formData);
      }
      setShowModal(false);
      resetForm();
      loadUsers();
    } catch (err: any) {
      // Backend error message will override frontend check if it's more specific
      setError(getApiErrorMessage(err, 'Failed to save user'));
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await api.userManagement.deleteUser(userId);
      loadUsers();
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to delete user'));
    }
  };

  const handleEdit = (user: UserListDto) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't pre-fill password
      role: user.role,
      businessName: user.businessName || '',
      gstNumber: '',
      address: '',
      bankName: '',
      bankAccountNo: '',
      ifscCode: '',
      panNumber: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    // Set default role based on current user's role
    const defaultRole = currentUserRole === 'MasterUser' ? 'Admin' : 'User';
    
    setFormData({
      name: '',
      email: '',
      password: '',
      role: defaultRole,
      businessName: '',
      gstNumber: '',
      address: '',
      bankName: '',
      bankAccountNo: '',
      ifscCode: '',
      panNumber: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
    });
    setEditingUser(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center">
              <UsersIcon className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className={`flex items-center px-4 py-2 ${themeColors.primary} text-white rounded-lg ${themeColors.primaryHover} transition-colors`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </button>
          </div>

          {error && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowInvoicesModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 hover:underline cursor-pointer"
                        title="View invoices for this user"
                      >
                        {user.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'MasterUser'
                            ? 'bg-red-100 text-red-800'
                            : user.role === 'Admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.createdByName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.businessName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        <Edit className="h-4 w-4 inline" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-12">
              <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No users</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new user.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Password {editingUser && '(leave blank to keep current)'}
                  </label>
                  <input
                    type="password"
                    name="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    disabled={!!editingUser} // Disable role change when editing
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {currentUserRole === 'MasterUser' ? (
                      <>
                        <option value="Admin">Admin</option>
                        <option value="User" disabled>User (Only Admin can create)</option>
                      </>
                    ) : currentUserRole === 'Admin' ? (
                      <>
                        <option value="User">User</option>
                        <option value="Admin" disabled>Admin (Only MasterUser can create)</option>
                      </>
                    ) : (
                      <option value="User">User</option>
                    )}
                  </select>
                  {currentUserRole === 'MasterUser' && (
                    <p className="mt-1 text-xs text-gray-500">MasterUser can only create Admin users</p>
                  )}
                  {currentUserRole === 'Admin' && (
                    <p className="mt-1 text-xs text-gray-500">Admin can only create User accounts</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Business Name</label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover}`}
                  >
                    {editingUser ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* User Invoices Modal */}
      {showInvoicesModal && selectedUser && (
        <UserInvoicesModal
          isOpen={showInvoicesModal}
          onClose={() => {
            setShowInvoicesModal(false);
            setSelectedUser(null);
          }}
          userId={selectedUser.id}
          userName={selectedUser.name}
        />
      )}
    </div>
  );
};

