import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { JobApplication, ApplicationStatus } from '../types';
import { applicationService } from '../services/api';
import KanbanBoard from '../components/kanban/KanbanBoard';
import ApplicationsTable from '../components/applications/ApplicationsTable';
import AddApplicationForm from '../components/forms/AddApplicationForm';
import { Grid, List, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

type ViewMode = 'kanban' | 'table';

const Applications: React.FC = () => {
  const { applications, setApplications, loading, refreshData, isMentorView } = useAppContext();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingApplication, setEditingApplication] = useState<JobApplication | undefined>();

  const handleAddApplication = async (formData: any) => {
    try {
      const newApp = await applicationService.create({
        companyName: formData.companyName,
        positionTitle: formData.positionTitle,
        location: formData.location,
        jobUrl: formData.jobUrl,
        salaryRange: formData.salaryRange,
        techStack: formData.techStack,
        visaSponsorship: formData.visaSponsorship,
        germanRequirement: formData.germanRequirement,
        relocationSupport: formData.relocationSupport,
        effort: formData.effort,
        jobBoardSource: formData.jobBoardSource,
        priorityStars: formData.priorityStars,
        notes: formData.notes,
        referralContactId: formData.referralContactId || undefined,
        appliedDate: new Date().toISOString().split('T')[0], // Backend expects Date or string YYYY-MM-DD
      });

      setApplications(prev => [...prev, newApp]);
      refreshData();
      toast.success(`Application added! +2 points! 🎉\n${formData.companyName} - ${formData.positionTitle}`, { duration: 4000 });
    } catch (error: any) {
      console.error("Failed to create application:", error);
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc?.slice(-1)[0]}: ${e.msg}`).join('; ')
        : detail || "Failed to create application. Please try again.";
      toast.error(message);
    }
  };

  const handleEditApplication = (application: JobApplication) => {
    setEditingApplication(application);
    setShowAddForm(true);
  };

  const handleUpdateApplication = async (formData: any) => {
    if (editingApplication) {
      try {
        const updatedApp = await applicationService.update(editingApplication.id, {
          companyName: formData.companyName,
          positionTitle: formData.positionTitle,
          location: formData.location,
          jobUrl: formData.jobUrl,
          salaryRange: formData.salaryRange,
          techStack: formData.techStack,
          visaSponsorship: formData.visaSponsorship,
          germanRequirement: formData.germanRequirement,
          relocationSupport: formData.relocationSupport,
          effort: formData.effort,
          jobBoardSource: formData.jobBoardSource,
          priorityStars: formData.priorityStars,
          notes: formData.notes,
          referralContactId: formData.referralContactId || undefined,
        });

        setApplications(prev =>
          prev.map(app =>
            app.id === editingApplication.id ? updatedApp : app
          )
        );

        refreshData();
        toast.success(`Application updated! +1 point! ✓\n${formData.companyName} - ${formData.positionTitle}`, { duration: 4000 });
      } catch (error: any) {
        console.error("Failed to update application:", error);
        const detail = error?.response?.data?.detail;
        const message = Array.isArray(detail)
          ? detail.map((e: any) => `${e.loc?.slice(-1)[0]}: ${e.msg}`).join('; ')
          : detail || "Failed to update application. Please try again.";
        toast.error(message);
      }
    }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (window.confirm("Are you sure you want to delete this application?")) {
      try {
        await applicationService.delete(applicationId);
        setApplications(prev => prev.filter(app => app.id !== applicationId));
        toast.success('Application deleted successfully.');
      } catch (error) {
        console.error("Failed to delete application:", error);
        toast.error("Failed to delete application. Please try again.");
      }
    }
  };

  const handleStatusUpdate = async (applicationId: string, newStatus: ApplicationStatus) => {
    try {
      const updatedApp = await applicationService.updateStatus(applicationId, newStatus);
      setApplications(prev =>
        prev.map(app =>
          app.id === applicationId ? updatedApp : app
        )
      );
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status. Transition might be invalid.");
    }
  };

  const handleFormSubmit = async (formData: any) => {
    if (editingApplication) {
      await handleUpdateApplication(formData);
    } else {
      await handleAddApplication(formData);
    }
    setShowAddForm(false);
    setEditingApplication(undefined);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingApplication(undefined);
  };

  // Get stats for the header
  const stats = {
    total: applications.length,
    applied: applications.filter(app => app.status === 'Applied').length,
    interviews: applications.filter(app =>
      ['Phone Screen', 'Technical Round 1', 'Technical Round 2', 'Final Round'].includes(app.status)
    ).length,
    fullEffort: applications.filter(app => app.effort === 'Full').length
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <div className="h-10 w-1/3 placeholder" /><div className="h-24 placeholder" /><div className="h-96 placeholder" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label">Applications</span>
          <h1 className="major mt-1">{stats.total} tracked</h1>
        </div>
        {!isMentorView && (
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
            <Plus className="w-5 h-5" strokeWidth={1.6} />
            Add application
          </button>
        )}
      </header>

      {/* The counts that matter, as readouts. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Total', stats.total, 'text-ink'],
          ['Applied', stats.applied, 'text-arc'],
          ['Interviews', stats.interviews, 'text-gold'],
          ['Full effort', stats.fullEffort, 'text-ink'],
        ].map(([label, n, tone]) => (
          <div key={label as string} className="instrument">
            <span className="label">{label}</span>
            <p className={`readout mt-2 ${tone}`}>{n}</p>
          </div>
        ))}
      </div>

      {/* View: tabs on an engraved rule. */}
      <div className="flex gap-5 border-b-2 border-engrave">
        {([['kanban', 'Board', Grid], ['table', 'Table', List]] as const).map(([mode, label, Icon]) => (
          <button key={mode} onClick={() => setViewMode(mode)} aria-current={viewMode === mode ? 'page' : undefined}
            className={`flex items-center gap-2 min-h-[44px] -mb-[2px] border-b-2 font-mono text-label uppercase tracking-stamp ${viewMode === mode ? 'text-arc border-arc' : 'text-ink-dim border-transparent hover:text-ink'}`}>
            <Icon className="w-4 h-4" strokeWidth={1.6} />{label}
          </button>
        ))}
      </div>

      {/* Content */}
      {viewMode === 'kanban' ? (
        <KanbanBoard
          applications={applications}
          onStatusUpdate={handleStatusUpdate}
          onEdit={handleEditApplication}
          onDelete={handleDeleteApplication}
        />
      ) : (
        <ApplicationsTable
          applications={applications}
          onEdit={handleEditApplication}
          onDelete={handleDeleteApplication}
          onStatusUpdate={handleStatusUpdate}
        />
      )}

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <AddApplicationForm
          onSubmit={handleFormSubmit}
          onClose={handleCloseForm}
          initialData={editingApplication ? {
            companyName: editingApplication.companyName,
            positionTitle: editingApplication.positionTitle,
            location: editingApplication.location,
            jobUrl: editingApplication.jobUrl,
            salaryRange: editingApplication.salaryRange,
            techStack: editingApplication.techStack,
            visaSponsorship: editingApplication.visaSponsorship,
            germanRequirement: editingApplication.germanRequirement,
            relocationSupport: editingApplication.relocationSupport,
            effort: editingApplication.effort,
            jobBoardSource: editingApplication.jobBoardSource,
            priorityStars: editingApplication.priorityStars,
            notes: editingApplication.notes,
            referralContactId: editingApplication.referralContactId
          } : undefined}
        />
      )}
    </div>
  );
};

export default Applications;