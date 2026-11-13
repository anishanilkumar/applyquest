import React from 'react';
import { User } from '../../types';
import { Save, X } from 'lucide-react';

interface UserProfileProps {
    user: User;
    isEditing: boolean;
    editForm: Partial<User>;
    onSave: (e: React.FormEvent) => void;
    onCancel: () => void;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({
    user,
    isEditing,
    editForm,
    onSave,
    onCancel,
    onChange
}) => {
    const germanLevels = ['None', 'Basic', 'Fluent', 'B1', 'B2', 'C1'];

    return (
        <div className="instrument h-full">
            <div className="flex items-center gap-3 mb-6">
                <h2 className="label">Profile Information</h2>
            </div>

            {isEditing ? (
                <form onSubmit={onSave} className="space-y-4">
                    <div>
                        <label className="field-label">
                            Full Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={editForm.name || ''}
                            onChange={onChange}
                            className="input w-full"
                            required
                        />
                    </div>
                    <div>
                        <label className="field-label">
                            Email Address
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={editForm.email || ''}
                            onChange={onChange}
                            className="input w-full"
                            required
                        />
                    </div>
                    <div>
                        <label className="field-label">
                            Current Education
                        </label>
                        <input
                            type="text"
                            name="currentEducation"
                            value={editForm.currentEducation || ''}
                            onChange={onChange}
                            className="input w-full"
                        />
                    </div>
                    <div>
                        <label className="field-label">
                            German Language Level
                        </label>
                        <select
                            name="germanLevel"
                            value={editForm.germanLevel || ''}
                            onChange={onChange}
                            className="input w-full"
                        >
                            <option value="">Select Level</option>
                            {germanLevels.map(level => (
                                <option key={level} value={level}>{level}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="field-label">
                            Current Role
                        </label>
                        <input
                            type="text"
                            name="currentRole"
                            value={editForm.currentRole || ''}
                            onChange={onChange}
                            className="input w-full"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            className="btn btn-primary flex-1 justify-center"
                        >
                            <Save className="w-4 h-4" />
                            Save
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="btn flex-1 justify-center"
                        >
                            <X className="w-4 h-4" />
                            Cancel
                        </button>
                    </div>
                </form>
            ) : (
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div>
                                <p className="field-label !mb-0.5">Full Name</p>
                                <p className="font-semibold text-ink text-lg">{user.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div>
                                <p className="field-label !mb-0.5">Email</p>
                                <p className="font-medium text-ink">{user.email}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div>
                                <p className="field-label !mb-0.5">Education</p>
                                <p className="font-medium text-ink">{user.currentEducation || 'Not specified'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div>
                                <p className="field-label !mb-0.5">German Level</p>
                                <p className="font-medium text-ink">{user.germanLevel || 'Not specified'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-4 border-t-2 border-engrave">
                            <div>
                                <p className="field-label !mb-0.5">Current Role</p>
                                <p className="font-medium text-ink">{user.currentRole || 'Looking for work'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfile;
