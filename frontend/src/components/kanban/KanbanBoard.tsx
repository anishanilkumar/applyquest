import React, { useState } from 'react';
import { MapPin, Star, Calendar, ExternalLink, Edit, Trash2, Users } from 'lucide-react';
import { JobApplication, ApplicationStatus } from '../../types';
import { useAppContext } from '../../context/AppContext';

interface KanbanBoardProps {
  applications: JobApplication[];
  onStatusUpdate: (applicationId: string, newStatus: ApplicationStatus) => void;
  onEdit: (application: JobApplication) => void;
  onDelete: (applicationId: string) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  applications,
  onStatusUpdate,
  onEdit,
  onDelete
}) => {
  const stages = [
    { id: 'Shortlisted', name: 'Shortlisted', color: 'bg-teal-500' },
    { id: 'Applied', name: 'Applied', color: 'bg-blue-500' },
    { id: 'Replied', name: 'Replied', color: 'bg-purple-500' },
    { id: 'Phone Screen', name: 'Phone Screen', color: 'bg-yellow-500' },
    { id: 'Technical Round 1', name: 'Technical 1', color: 'bg-orange-500' },
    { id: 'Technical Round 2', name: 'Technical 2', color: 'bg-pink-500' },
    { id: 'Final Round', name: 'Final Round', color: 'bg-indigo-500' },
    { id: 'Offer', name: 'Offer', color: 'bg-green-500' },
    { id: 'Rejected', name: 'Rejected', color: 'bg-red-500' },
    { id: 'Ghosted', name: 'Ghosted', color: 'bg-gray-500' },
  ];


  const { isMentorView } = useAppContext();
  const [draggedItem, setDraggedItem] = useState<JobApplication | null>(null);

  const handleDragStart = (app: JobApplication) => {
    if (isMentorView) return;
    setDraggedItem(app);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isMentorView) return;
    e.preventDefault();
  };

  const handleDrop = (stageId: string) => {
    if (isMentorView) return;
    if (draggedItem) {
      onStatusUpdate(draggedItem.id, stageId as ApplicationStatus);
      setDraggedItem(null);
    }
  };

  const getApplicationsByStage = (stageId: string) => {
    return applications
      .filter(app => app.status === stageId)
      .sort((a, b) => {
        const dateDiff = new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.priorityStars - a.priorityStars;
      });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDelete = (id: string) => {
    onDelete(id);
  };

  const handleQuickStatus = (id: string, newStatus: ApplicationStatus) => {
    onStatusUpdate(id, newStatus);
  };

  return (
    <div>
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Application Board</h1>
          <p className="text-gray-600">Drag and drop applications to update their status</p>
          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-gray-600">Early Stage</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-600">Interview Process</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-600">Success</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span className="text-gray-600">No Response</span>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageApps = getApplicationsByStage(stage.id);

            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-80"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage.id)}
              >
                {/* Column Header */}
                <div className={`${stage.color} text-white rounded-lg p-4 mb-3 shadow-md`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">{stage.name}</h3>
                    <span className="bg-white bg-opacity-30 rounded-full px-3 py-1 text-sm font-semibold">
                      {stageApps.length}
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="space-y-3 min-h-[200px]">
                  {stageApps.length === 0 && (
                    <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                      <p className="text-gray-400 text-sm">Drop applications here</p>
                    </div>
                  )}

                  {stageApps.map((app) => (
                    <div
                      key={app.id}
                      draggable={!isMentorView}
                      onDragStart={() => handleDragStart(app)}
                      className={`bg-white rounded-lg p-4 shadow-md hover:shadow-lg transition-all border-2 border-transparent hover:border-blue-300 ${isMentorView ? 'cursor-default' : 'cursor-move'}`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-800">{app.companyName}</h4>
                            {app.referralContactId && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800" title="Referred by network contact">
                                <Users className="w-3 h-3" />
                              </span>
                            )}
                            {app.easyApply && (
                              <span className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 border border-green-200 whitespace-nowrap" title="Applied via Easy Apply">
                                ⚡ Easy Apply
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{app.positionTitle}</p>
                        </div>
                        <div className="flex gap-1">
                          {[...Array(app.priorityStars)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <MapPin className="w-4 h-4" />
                        <span>{app.location}</span>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {app.visaSponsorship && (
                          <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                            Visa
                          </span>
                        )}
                        {app.germanRequirement !== 'None' && (
                          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                            German: {app.germanRequirement}
                          </span>
                        )}
                        {app.salaryRange && (
                          <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
                            €{app.salaryRange}
                          </span>
                        )}
                      </div>

                      {/* Tech Stack */}
                      {app.techStack && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-1">Tech Stack:</p>
                          <p className="text-xs text-gray-700 truncate">{app.techStack}</p>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(app.appliedDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {app.jobUrl && (
                            <button
                              onClick={() => window.open(app.jobUrl, '_blank')}
                              className="text-blue-500 hover:text-blue-700 p-1"
                              title="Open job posting"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                          {!isMentorView && (
                            <>
                              <button
                                onClick={() => onEdit(app)}
                                className="text-gray-500 hover:text-blue-700 p-1"
                                title="Edit application"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(app.id)}
                                className="text-gray-500 hover:text-red-700 p-1"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      {!isMentorView && app.status === 'Shortlisted' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => handleQuickStatus(app.id, 'Applied')}
                            className="flex-1 bg-blue-50 text-blue-700 text-xs py-2 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                          >
                            Mark Applied
                          </button>
                          <button
                            onClick={() => handleQuickStatus(app.id, 'Rejected')}
                            className="flex-1 bg-red-50 text-red-700 text-xs py-2 rounded-lg hover:bg-red-100 transition-colors font-medium"
                          >
                            Skip
                          </button>
                        </div>
                      )}
                      {!isMentorView && app.status !== 'Shortlisted' && app.status !== 'Rejected' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => handleQuickStatus(app.id, 'Rejected')}
                            className="flex-1 bg-red-50 text-red-700 text-xs py-2 rounded-lg hover:bg-red-100 transition-colors font-medium"
                          >
                            Mark Rejected
                          </button>
                          {app.status !== 'Ghosted' && (
                            <button
                              onClick={() => handleQuickStatus(app.id, 'Ghosted')}
                              className="flex-1 bg-gray-50 text-gray-700 text-xs py-2 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                            >
                              Mark Ghosted
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default KanbanBoard;