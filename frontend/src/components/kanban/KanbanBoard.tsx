import React, { useState } from 'react';
import { MapPin, Calendar, ExternalLink, Edit, Trash2, Users, FileText } from 'lucide-react';
import { JobApplication, ApplicationStatus } from '../../types';
import { EFFORT_TONE, EFFORT_DESCRIPTION } from '../../utils/effort';
import { Priority, Tag } from '../common/Marks';
import { stageVar } from '../../utils/statusStyle';
import { useAppContext } from '../../context/AppContext';

interface KanbanBoardProps {
  applications: JobApplication[];
  onStatusUpdate: (applicationId: string, newStatus: ApplicationStatus) => void;
  onEdit: (application: JobApplication) => void;
  onDelete: (applicationId: string) => void;
}

// Stages where the employer is engaged, so the drafted documents are worth
// having to hand.
const PREP_STAGES: ApplicationStatus[] = [
  'Replied', 'Phone Screen', 'Technical Round 1', 'Technical Round 2', 'Final Round', 'Offer',
];

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  applications,
  onStatusUpdate,
  onEdit,
  onDelete
}) => {
  const stages = [
    { id: 'Shortlisted', name: 'Shortlisted' },
    { id: 'Applied', name: 'Applied' },
    { id: 'Replied', name: 'Replied' },
    { id: 'Phone Screen', name: 'Phone Screen' },
    { id: 'Technical Round 1', name: 'Technical 1' },
    { id: 'Technical Round 2', name: 'Technical 2' },
    { id: 'Final Round', name: 'Final Round' },
    { id: 'Offer', name: 'Offer' },
    { id: 'Rejected', name: 'Rejected' },
    { id: 'Ghosted', name: 'Ghosted' },
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
          <div className="flex flex-wrap gap-x-5 gap-y-1 stamp uppercase">
            {!isMentorView && <span className="normal-case text-ink-dim mr-2">Drag a card to change its status.</span>}
            {[['Shortlisted', 'Not sent'], ['Applied', 'Sent'], ['Replied', 'In conversation'], ['Offer', 'Offer'], ['Rejected', 'Ended']].map(([s, word]) => (
              <span key={s} className="flex items-center gap-2"><i className="dot" style={{ ['--c' as any]: stageVar(s) }} />{word}</span>
            ))}
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
                {/* Column header: the stage's dot and name on an engraved rule. */}
                <div className="flex items-center justify-between min-h-[44px] mb-3 border-b-2 border-engrave">
                  <h3 className="flex items-center gap-2 font-mono text-label uppercase tracking-stamp text-ink">
                    <i className="dot" style={{ ['--c' as any]: stageVar(stage.id) }} />{stage.name}
                  </h3>
                  <span className="font-mono text-label text-ink-dim">{stageApps.length}</span>
                </div>

                {/* Cards Container */}
                <div className="space-y-3 min-h-[200px]">
                  {stageApps.length === 0 && (
                    <div className="border-2 border-dashed border-engrave p-8 text-center">
                      <p className="empty-title text-min">Empty</p>
                    </div>
                  )}

                  {stageApps.map((app) => (
                    <div
                      key={app.id}
                      draggable={!isMentorView}
                      onDragStart={() => handleDragStart(app)}
                      className={`bg-panel p-4 transition-colors border-2 border-transparent hover:bg-panel-lit ${isMentorView ? 'cursor-default' : 'cursor-move'}`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className="font-semibold text-ink">{app.companyName}</h4>
                            {app.referralContactId && (
                              <Tag title="Referred by network contact"><Users className="w-3 h-3" strokeWidth={1.6} /></Tag>
                            )}
                            {app.effort !== 'Unknown' && (
                              <Tag tone={EFFORT_TONE[app.effort]} title={EFFORT_DESCRIPTION[app.effort]}>{app.effort}</Tag>
                            )}
                            {app.fitScore !== undefined && (
                              <Tag title="Fit score from ai-job-search">Fit {app.fitScore}</Tag>
                            )}
                          </div>
                          <p className="text-sm text-ink-dim">{app.positionTitle}</p>
                        </div>
                        {app.priorityStars > 0 && <div className="pt-1.5"><Priority value={app.priorityStars} /></div>}
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-2 text-sm text-ink-dim mb-3">
                        <MapPin className="w-4 h-4" strokeWidth={1.6} />
                        <span>{app.location}</span>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {app.visaSponsorship && (
                          <Tag>Visa</Tag>
                        )}
                        {app.germanRequirement !== 'None' && (
                          <Tag>German {app.germanRequirement}</Tag>
                        )}
                        {app.salaryRange && (
                          <Tag>€{app.salaryRange}</Tag>
                        )}
                      </div>

                      {/* Prep files: the documents drafted for this application, once
                          the employer is talking — names only, the files stay local */}
                      {PREP_STAGES.includes(app.status) && (app.cvFile || app.coverLetterFile || app.researchFile) && (
                        <div className="mb-3 bg-ground border-2 border-engrave p-2">
                          <p className="label text-min mb-1">Prep files</p>
                          {[['CV', app.cvFile], ['Cover letter', app.coverLetterFile], ['Research', app.researchFile]]
                            .filter(([, file]) => file)
                            .map(([label, file]) => (
                              <div key={label} className="flex items-center gap-1 text-xs text-ink min-w-0" title={file}>
                                <FileText className="w-3 h-3 flex-shrink-0 text-ink-dim" strokeWidth={1.6} />
                                <span className="text-ink-dim flex-shrink-0">{label}:</span>
                                <span className="font-mono truncate">{file!.split('/').pop()}</span>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Tech Stack */}
                      {app.techStack && (
                        <div className="mb-3">
                          <p className="stamp uppercase mb-1">Stack</p>
                          <p className="text-sm text-ink truncate">{app.techStack}</p>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-engrave">
                        <div className="flex items-center gap-1 stamp">
                          <Calendar className="w-3 h-3" strokeWidth={1.6} />
                          <span>{formatDate(app.appliedDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {app.jobUrl && (
                            <button
                              onClick={() => window.open(app.jobUrl, '_blank')}
                              className="btn btn-quiet btn-icon border-transparent hover:text-arc"
                              title="Open job posting"
                            >
                              <ExternalLink className="w-4 h-4" strokeWidth={1.6} />
                            </button>
                          )}
                          {!isMentorView && (
                            <>
                              <button
                                onClick={() => onEdit(app)}
                                className="btn btn-quiet btn-icon border-transparent hover:text-arc"
                                title="Edit application"
                              >
                                <Edit className="w-4 h-4" strokeWidth={1.6} />
                              </button>
                              <button
                                onClick={() => handleDelete(app.id)}
                                className="btn btn-quiet btn-icon border-transparent hover:text-alert"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" strokeWidth={1.6} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      {!isMentorView && app.status === 'Shortlisted' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-engrave">
                          <button
                            onClick={() => handleQuickStatus(app.id, 'Applied')}
                            className="btn btn-sm flex-1"
                          >
                            Mark Applied
                          </button>
                          <button
                            onClick={() => handleQuickStatus(app.id, 'Rejected')}
                            className="btn btn-sm btn-quiet flex-1"
                          >
                            Skip
                          </button>
                        </div>
                      )}
                      {!isMentorView && app.status !== 'Shortlisted' && app.status !== 'Rejected' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-engrave">
                          <button
                            onClick={() => handleQuickStatus(app.id, 'Rejected')}
                            className="btn btn-sm btn-quiet flex-1"
                          >
                            Mark Rejected
                          </button>
                          {app.status !== 'Ghosted' && (
                            <button
                              onClick={() => handleQuickStatus(app.id, 'Ghosted')}
                              className="btn btn-sm btn-quiet flex-1"
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