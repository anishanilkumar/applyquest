import React, { useMemo, useState } from 'react';
import { Bell, Clock, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { applicationService, userService } from '../services/api';
import { ApplicationStatus } from '../types';
import { classifyApp, daysSince, NEXT_STAGE } from '../utils/followup';

const STATUS_COLORS: Record<string, string> = {
  Shortlisted: 'bg-teal-100 text-teal-700',
  Applied: 'bg-blue-100 text-blue-700',
  Replied: 'bg-purple-100 text-purple-700',
  'Phone Screen': 'bg-yellow-100 text-yellow-700',
  'Technical Round 1': 'bg-orange-100 text-orange-700',
  'Technical Round 2': 'bg-pink-100 text-pink-700',
  'Final Round': 'bg-indigo-100 text-indigo-700',
  Offer: 'bg-green-100 text-green-700',
};

const FollowupPage: React.FC = () => {
  const { applications, setApplications, setUser, isMentorView } = useAppContext();
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const { needsFollowup, awaitingResponse, needsDecision } = useMemo(() => {
    const needsFollowup = applications.filter(a => classifyApp(a) === 'needs_followup');
    const awaitingResponse = applications.filter(a => classifyApp(a) === 'awaiting_response');
    const needsDecision = applications.filter(a => classifyApp(a) === 'needs_decision');
    return { needsFollowup, awaitingResponse, needsDecision };
  }, [applications]);

  const setLoading = (id: string, loading: boolean) => {
    setLoadingIds(prev => {
      const next = new Set(prev);
      loading ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleUnflag = async (id: string) => {
    if (isMentorView) return;
    setLoading(id, true);
    try {
      const updated = await applicationService.setFollowupFlag(id, false);
      setApplications(prev => prev.map(a => a.id === id ? updated : a));
      toast.success('Removed from followup queue');
    } catch {
      toast.error('Failed to remove from queue');
    } finally {
      setLoading(id, false);
    }
  };

  const handleMarkFollowedUp = async (id: string) => {
    if (isMentorView) return;
    setLoading(id, true);
    try {
      const updated = await applicationService.markFollowedUp(id);
      setApplications(prev => prev.map(a => a.id === id ? updated : a));
      const updatedUser = await userService.getCurrentUser();
      setUser(updatedUser);
      toast.success('Marked as followed up! +1 point');
    } catch {
      toast.error('Failed to mark as followed up');
    } finally {
      setLoading(id, false);
    }
  };

  const handleUpdateStatus = async (id: string, status: ApplicationStatus) => {
    if (isMentorView) return;
    setLoading(id, true);
    try {
      const updated = await applicationService.updateStatus(id, status);
      setApplications(prev => prev.map(a => a.id === id ? updated : a));
      toast.success(`Marked as ${status}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setLoading(id, false);
    }
  };

  const totalActionable = needsFollowup.length + needsDecision.length;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Bell className="w-7 h-7 text-amber-500" />
          <h1 className="text-3xl font-bold text-gray-800">Followup Queue</h1>
          {totalActionable > 0 && (
            <span className="bg-red-500 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
              {totalActionable}
            </span>
          )}
        </div>
        <p className="text-gray-500 ml-10">Applications you flagged to chase up</p>
      </div>

      {totalActionable === 0 && awaitingResponse.length === 0 && (
        <div className="bg-white rounded-xl p-12 shadow-md text-center border-2 border-green-100">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">All caught up!</h2>
          <p className="text-gray-500">Nothing is flagged for followup right now.</p>
        </div>
      )}

      {/* Needs Decision */}
      {needsDecision.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-bold text-red-700">Needs Decision ({needsDecision.length})</h2>
            <span className="text-sm text-gray-500">— followed up 3+ days ago, no response</span>
          </div>
          <div className="space-y-3">
            {needsDecision.map(app => {
              const next = NEXT_STAGE[app.status];
              const busy = loadingIds.has(app.id);
              return (
                <div key={app.id} className="bg-white rounded-xl p-5 shadow-md border-l-4 border-red-400">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-800 text-lg">{app.companyName}</p>
                      <p className="text-gray-600">{app.positionTitle}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-600'}`}>
                          {app.status}
                        </span>
                        {app.followedUpAt && (
                          <span className="text-xs text-red-600">
                            Followed up {daysSince(app.followedUpAt)} days ago
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleUpdateStatus(app.id, 'Ghosted')}
                        disabled={busy || isMentorView}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        Ghosted
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(app.id, 'Rejected')}
                        disabled={busy || isMentorView}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        Rejected
                      </button>
                      {next && (
                        <button
                          onClick={() => handleUpdateStatus(app.id, next)}
                          disabled={busy || isMentorView}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                        >
                          {next} <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Needs Followup */}
      {needsFollowup.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-amber-700">Needs Followup ({needsFollowup.length})</h2>
            <span className="text-sm text-gray-500">— flagged, not yet followed up</span>
          </div>
          <div className="space-y-3">
            {needsFollowup.map(app => {
              const busy = loadingIds.has(app.id);
              // Days since applying — updatedAt is bumped by flagging itself, so it says nothing useful here.
              const appliedDays = daysSince(app.appliedDate);
              return (
                <div key={app.id} className="bg-white rounded-xl p-5 shadow-md border-l-4 border-amber-400">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-800 text-lg">{app.companyName}</p>
                      <p className="text-gray-600">{app.positionTitle}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-600'}`}>
                          {app.status}
                        </span>
                        <span className="text-xs text-amber-600">
                          {appliedDays === 0 ? 'Applied today' : `Applied ${appliedDays} day${appliedDays > 1 ? 's' : ''} ago`}
                        </span>
                      </div>
                    </div>
                    {!isMentorView && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleUnflag(app.id)}
                          disabled={busy}
                          className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          Not chasing
                        </button>
                        <button
                          onClick={() => handleMarkFollowedUp(app.id)}
                          disabled={busy}
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {busy ? 'Saving…' : 'Mark Followed Up'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Awaiting Response */}
      {awaitingResponse.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-blue-700">Awaiting Response ({awaitingResponse.length})</h2>
            <span className="text-sm text-gray-500">— followed up, within 3-day window</span>
          </div>
          <div className="space-y-3">
            {awaitingResponse.map(app => (
              <div key={app.id} className="bg-white rounded-xl p-5 shadow-md border-l-4 border-blue-300 opacity-80">
                <p className="font-semibold text-gray-800">{app.companyName}</p>
                <p className="text-gray-600 text-sm">{app.positionTitle}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-600'}`}>
                    {app.status}
                  </span>
                  {app.followedUpAt && (
                    <span className="text-xs text-blue-500">
                      Followed up {daysSince(app.followedUpAt) === 0 ? 'today' : `${daysSince(app.followedUpAt)} day${daysSince(app.followedUpAt) > 1 ? 's' : ''} ago`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default FollowupPage;
