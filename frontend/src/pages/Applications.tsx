import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { JobApplication, ApplicationStatus } from '../types';
import { applicationService } from '../services/api';
import KanbanBoard from '../components/kanban/KanbanBoard';
import ApplicationsTable from '../components/applications/ApplicationsTable';
import AddApplicationForm from '../components/forms/AddApplicationForm';
import { Grid, List, Plus, BarChart3 } from 'lucide-react';
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
        easyApply: formData.easyApply,
        jobBoardSource: formData.jobBoardSource,
        priorityStars: formData.priorityStars,
        notes: formData.notes,
        followupFlagged: formData.followupFlagged,
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
          easyApply: formData.easyApply,
          jobBoardSource: formData.jobBoardSource,
          priorityStars: formData.priorityStars,
          notes: formData.notes,
          followupFlagged: formData.followupFlagged,
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

  const handleToggleFollowupFlag = async (applicationId: string, flagged: boolean) => {
    try {
      const updatedApp = await applicationService.setFollowupFlag(applicationId, flagged);
      setApplications(prev =>
        prev.map(app => (app.id === applicationId ? updatedApp : app))
      );
      toast.success(flagged ? 'Flagged for followup' : 'Removed from followup queue');
    } catch (error) {
      console.error("Failed to update followup flag:", error);
      toast.error("Failed to update followup flag.");
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
      if (newStatus === 'Applied') {
        toast((t) => (
          <span className="flex items-center gap-3">
            Track a followup for this one?
            <button
              onClick={() => {
                toast.dismiss(t.id);
                handleToggleFollowupFlag(applicationId, true);
              }}
              className="px-2 py-1 text-sm font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600"
            >
              Track followup
            </button>
          </span>
        ), { duration: 6000 });
      }
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
    easyApplied: applications.filter(app => app.easyApply).length
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading applications...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Job Applications</h1>
            <p className="text-gray-600">Track and manage your job search applications</p>
          </div>
          {!isMentorView && (
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl px-6 py-3 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Application
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-blue-800">Total Applications</div>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.applied}</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{stats.applied}</div>
                <div className="text-sm text-purple-800">Applied</div>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.interviews}</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{stats.interviews}</div>
                <div className="text-sm text-yellow-800">Interviews</div>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{stats.easyApplied}</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.easyApplied}</div>
                <div className="text-sm text-green-800">Easy Applied</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="bg-white rounded-xl p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${viewMode === 'kanban'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <Grid className="w-4 h-4" />
              Kanban Board
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${viewMode === 'table'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <List className="w-4 h-4" />
              Table View
            </button>
          </div>
          <div className="text-sm text-gray-600">
            {viewMode === 'kanban' ? 'Visual board view' : 'Detailed list view'}
          </div>
        </div>
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
          onToggleFollowupFlag={handleToggleFollowupFlag}
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
            easyApply: editingApplication.easyApply,
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