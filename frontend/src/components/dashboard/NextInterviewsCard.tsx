import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Video, Users } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { countdown, isInProgress, upcomingInterviews, whenLabel } from '../../utils/interviews';

const SHOWN = 4;

// The next few interviews, soonest first, so the day's conversations are the
// first thing on the Dashboard. The full calendar lives on /interviews.
const NextInterviewsCard: React.FC = () => {
  const { interviews, applications } = useAppContext();
  const navigate = useNavigate();
  const appById = useMemo(() => new Map(applications.map(a => [a.id, a])), [applications]);
  const upcoming = useMemo(() => upcomingInterviews(interviews), [interviews]);

  return (
    <div className="bg-white rounded-xl p-6 shadow-md mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-full p-3">
            <CalendarClock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Next interviews</h2>
            <p className="text-xs text-gray-500">
              {upcoming.length === 0 ? 'Nothing scheduled' : `${upcoming.length} scheduled`}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => navigate('/interviews')} className="text-sm text-blue-600 hover:underline font-medium">
          Calendar →
        </button>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-gray-500">
          When a recruiter books a call, it shows up here — added on the calendar page, or recorded by /interview-watch from the invite.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {upcoming.slice(0, SHOWN).map(i => {
            const app = appById.get(i.applicationId);
            const live = isInProgress(i);
            return (
              <li key={i.id} className="py-3 flex items-center gap-4">
                <div className={`w-24 shrink-0 text-sm font-semibold ${live ? 'text-red-600' : 'text-gray-800'}`}>
                  {whenLabel(i)}
                  <div className={`text-xs font-normal ${live ? 'text-red-500' : 'text-gray-500'}`}>{countdown(i)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-800 truncate">
                    {app?.companyName ?? 'Unknown application'}
                    {(i.title || i.stage) && <span className="font-normal text-gray-500"> · {i.title ?? i.stage}</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{app?.positionTitle}</div>
                  {i.interviewers && (
                    <div className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3 shrink-0" /> {i.interviewers}
                    </div>
                  )}
                </div>
                {i.meetingUrl && (
                  <a href={i.meetingUrl} target="_blank" rel="noopener noreferrer"
                    className={`shrink-0 inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg font-medium ${live ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    <Video className="w-4 h-4" /> Join
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {upcoming.length > SHOWN && (
        <p className="text-xs text-gray-500 mt-2">+{upcoming.length - SHOWN} more on the calendar</p>
      )}
    </div>
  );
};

export default NextInterviewsCard;
