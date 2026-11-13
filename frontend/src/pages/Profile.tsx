import React, { useState } from 'react';
import { User } from '../types';
import { useAppContext } from '../context/AppContext';
import { userService } from '../services/api';
import UserProfile from '../components/profile/UserProfile';
import ExperienceLevels from '../components/gamification/ExperienceLevels';

const Profile: React.FC = () => {
  const { user, setUser, applications, contacts, loading, isMentorView } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});

  const handleEditProfile = () => {
    if (user) {
      setEditForm({
        name: user.name,
        email: user.email,
        currentEducation: user.currentEducation,
        germanLevel: user.germanLevel,
        currentRole: user.currentRole
      });
      setIsEditing(true);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      try {
        const updatedUser = await userService.updateUser(editForm);
        setUser(updatedUser);
        setIsEditing(false);
        alert('Profile updated successfully!');
      } catch (error) {
        console.error("Failed to update profile:", error);
        alert("Failed to update profile. Please try again.");
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return <div className="p-8 text-center text-ink-dim">Loading profile...</div>;
  }

  if (!user) {
    return <div className="p-8 text-center text-ink-dim">User not found</div>;
  }

  // Calculate stats
  const currentStreak = user.currentStreak;
  const longestStreak = user.longestStreak;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <div className="flex items-end justify-between">
          <div>
            <span className="label">Profile</span>
            <h1 className="major mt-1">{user.name}</h1>
          </div>
          {!isEditing && !isMentorView && (
            <button
              onClick={handleEditProfile}
              className="btn"
            >
              Edit profile
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - User Info */}
        <div className="lg:col-span-1 space-y-6">
          <UserProfile
            user={user}
            isEditing={isEditing}
            editForm={editForm}
            onSave={handleSaveProfile}
            onCancel={handleCancelEdit}
            onChange={handleChange}
          />

          {/* Points and streaks, as readouts. */}
          <div className="instrument">
            <h3 className="label mb-3">Record</h3>
            <dl>
              {[['Points', `${user.points}`, `Level ${user.level} · ${user.levelName}`],
                ['Streak', `${currentStreak} days`, 'Working days in a row'],
                ['Best streak', `${longestStreak} days`, '']].map(([k, v, sub], i) => (
                <div key={k} className={`flex items-baseline justify-between gap-3 py-3 ${i ? 'border-t-2 border-engrave' : ''}`}>
                  <dt>
                    <span className="block text-ink">{k}</span>
                    {sub && <span className="stamp">{sub}</span>}
                  </dt>
                  <dd className="font-mono text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Right Column - Experience & Details */}
        <div className="lg:col-span-2 space-y-6">
          <ExperienceLevels currentPoints={user.points} />

          {/* Stats Summary */}
          <div className="instrument">
            <h3 className="label mb-3">Applications</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-panel-lit">
                <div className="readout text-ink">{applications.length}</div>
                <div className="stamp mt-1">Total Applications</div>
              </div>
              <div className="p-4 bg-panel-lit">
                <div className="readout text-ink">{contacts.length}</div>
                <div className="stamp mt-1">Network Contacts</div>
              </div>
              <div className="p-4 bg-panel-lit">
                <div className="readout text-ink">{applications.filter(a => a.status === 'Offer').length}</div>
                <div className="stamp mt-1">Offers Received</div>
              </div>
              <div className="p-4 bg-panel-lit">
                <div className="readout text-ink">{Math.round(applications.length > 0 ? (applications.filter(a => a.status !== 'Applied' && a.status !== 'Ghosted').length / applications.length) * 100 : 0)}%</div>
                <div className="stamp mt-1">Response Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;