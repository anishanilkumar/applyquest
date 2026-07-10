import React, { useState, useMemo } from 'react';
import { JobApplication, ApplicationStatus, GermanLevel } from '../../types';
import { useAppContext } from '../../context/AppContext';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit,
  Trash2,
  ExternalLink,
  Star,
  MapPin,
  Calendar,
  Briefcase,
  Users,
  Bell
} from 'lucide-react';

interface ApplicationsTableProps {
  applications: JobApplication[];
  onEdit: (application: JobApplication) => void;
  onDelete: (applicationId: string) => void;
  onStatusUpdate: (applicationId: string, newStatus: ApplicationStatus) => void;
  onToggleFollowupFlag: (applicationId: string, flagged: boolean) => void;
}

type SortField = 'appliedDate' | 'companyName' | 'positionTitle' | 'location' | 'status' | 'priorityStars';
type SortDirection = 'asc' | 'desc';

const ApplicationsTable: React.FC<ApplicationsTableProps> = ({
  applications,
  onEdit,
  onDelete,
  onStatusUpdate,
  onToggleFollowupFlag
}) => {
  const { isMentorView } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [visaFilter, setVisaFilter] = useState<'all' | 'true' | 'false'>('all');
  const [germanFilter, setGermanFilter] = useState<GermanLevel | 'all'>('all');
  const [easyApplyFilter, setEasyApplyFilter] = useState<'all' | 'true' | 'false'>('all');
  const [sortField, setSortField] = useState<SortField>('appliedDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());

  // Get unique locations for filter
  const uniqueLocations = useMemo(() => {
    const locations = new Set(applications.map(app => app.location));
    return Array.from(locations).sort();
  }, [applications]);

  // Status options
  const statusOptions: ApplicationStatus[] = [
    'Applied', 'Replied', 'Phone Screen', 'Technical Round 1',
    'Technical Round 2', 'Final Round', 'Offer', 'Rejected', 'Ghosted'
  ];

  // Filter and sort applications
  const filteredAndSortedApplications = useMemo(() => {
    let filtered = applications.filter(app => {
      const matchesSearch = searchTerm === '' ||
        app.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.positionTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.techStack?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.jobBoardSource?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
      const matchesLocation = locationFilter === 'all' || app.location === locationFilter;
      const matchesVisa = visaFilter === 'all' || app.visaSponsorship.toString() === visaFilter;
      const matchesGerman = germanFilter === 'all' || app.germanRequirement === germanFilter;
      const matchesEasyApply = easyApplyFilter === 'all' || app.easyApply.toString() === easyApplyFilter;

      return matchesSearch && matchesStatus && matchesLocation && matchesVisa && matchesGerman && matchesEasyApply;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'appliedDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [applications, searchTerm, statusFilter, locationFilter, visaFilter, germanFilter, easyApplyFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case 'Applied': return 'bg-blue-100 text-blue-800';
      case 'Replied': return 'bg-purple-100 text-purple-800';
      case 'Phone Screen': return 'bg-yellow-100 text-yellow-800';
      case 'Technical Round 1':
      case 'Technical Round 2': return 'bg-orange-100 text-orange-800';
      case 'Final Round': return 'bg-indigo-100 text-indigo-800';
      case 'Offer': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Ghosted': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedApps(new Set(filteredAndSortedApplications.map(app => app.id)));
    } else {
      setSelectedApps(new Set());
    }
  };

  const handleSelectApp = (appId: string, checked: boolean) => {
    const newSelected = new Set(selectedApps);
    if (checked) {
      newSelected.add(appId);
    } else {
      newSelected.delete(appId);
    }
    setSelectedApps(newSelected);
  };

  const handleBulkStatusUpdate = (newStatus: ApplicationStatus) => {
    selectedApps.forEach(appId => {
      onStatusUpdate(appId, newStatus);
    });
    setSelectedApps(new Set());
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedApps.size} selected applications?`)) {
      selectedApps.forEach(appId => {
        onDelete(appId);
      });
      setSelectedApps(new Set());
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by company, position, location, or tech stack..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Status</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Locations</option>
              {uniqueLocations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>

            <select
              value={visaFilter}
              onChange={(e) => setVisaFilter(e.target.value as 'all' | 'true' | 'false')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">Visa Sponsorship</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>

            <select
              value={germanFilter}
              onChange={(e) => setGermanFilter(e.target.value as GermanLevel | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">German Level</option>
              <option value="None">None</option>
              <option value="Basic">Basic</option>
              <option value="Fluent">Fluent</option>
            </select>

            <select
              value={easyApplyFilter}
              onChange={(e) => setEasyApplyFilter(e.target.value as 'all' | 'true' | 'false')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">Easy Apply</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredAndSortedApplications.length} of {applications.length} applications
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedApps.size > 0 && !isMentorView && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800 font-medium">
              {selectedApps.size} application{selectedApps.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <select
                onChange={(e) => handleBulkStatusUpdate(e.target.value as ApplicationStatus)}
                className="px-3 py-1 border border-blue-300 rounded text-sm bg-white"
                defaultValue=""
              >
                <option value="" disabled>Update Status</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedApps.size === filteredAndSortedApplications.length && filteredAndSortedApplications.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('companyName')}
                >
                  <div className="flex items-center gap-2">
                    Company {getSortIcon('companyName')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('positionTitle')}
                >
                  <div className="flex items-center gap-2">
                    Position {getSortIcon('positionTitle')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('location')}
                >
                  <div className="flex items-center gap-2">
                    Location {getSortIcon('location')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status {getSortIcon('status')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('appliedDate')}
                >
                  <div className="flex items-center gap-2">
                    Applied {getSortIcon('appliedDate')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('priorityStars')}
                >
                  <div className="flex items-center gap-2">
                    Priority {getSortIcon('priorityStars')}
                  </div>
                </th>
                {!isMentorView && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedApplications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedApps.has(app.id)}
                      onChange={(e) => handleSelectApp(app.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                          <Briefcase className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900">{app.companyName}</div>
                          {app.referralContactId && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800" title="Referred by network contact">
                              <Users className="w-3 h-3" />
                              Referral
                            </span>
                          )}
                          {app.easyApply && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800" title="Applied via Easy Apply">
                              Easy Apply
                            </span>
                          )}
                        </div>
                        {app.jobBoardSource && (
                          <div className="text-sm text-gray-500">{app.jobBoardSource}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{app.positionTitle}</div>
                    {app.techStack && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">{app.techStack}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                      {app.location}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(app.status)}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                      {formatDate(app.appliedDate)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {[...Array(app.priorityStars)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  </td>
                  {!isMentorView && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {app.jobUrl && (
                          <button
                            onClick={() => window.open(app.jobUrl, '_blank')}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="View job posting"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onToggleFollowupFlag(app.id, !app.followupFlagged)}
                          className={`p-1 ${app.followupFlagged ? 'text-amber-500 hover:text-amber-600' : 'text-gray-600 hover:text-amber-500'}`}
                          title={app.followupFlagged ? 'Remove from followup queue' : 'Flag for followup'}
                        >
                          <Bell className={`w-4 h-4 ${app.followupFlagged ? 'fill-amber-400' : ''}`} />
                        </button>
                        <button
                          onClick={() => onEdit(app)}
                          className="text-gray-600 hover:text-blue-900 p-1"
                          title="Edit application"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(app.id)}
                          className="text-gray-600 hover:text-red-900 p-1"
                          title="Delete application"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedApplications.length === 0 && (
          <div className="text-center py-12">
            <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No applications found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {applications.length === 0
                ? "Get started by adding your first job application."
                : "Try adjusting your search or filters."
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplicationsTable;