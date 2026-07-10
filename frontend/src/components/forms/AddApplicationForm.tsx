import React, { useState, useEffect } from 'react';
import { X, Briefcase, MapPin, DollarSign, Code, Star, Link2, Globe, Building, Users } from 'lucide-react';
import { api } from '../../services/api';
import type { NetworkContact } from '../../types';

interface ApplicationFormData {
  companyName: string;
  positionTitle: string;
  location: string;
  jobUrl: string;
  salaryRange: string;
  techStack: string;
  visaSponsorship: boolean;
  germanRequirement: string;
  relocationSupport: boolean;
  easyApply: boolean;
  followupFlagged: boolean;
  jobBoardSource: string;
  priorityStars: number;
  notes: string;
  referralContactId?: string;
}

interface AddApplicationFormProps {
  onSubmit: (data: ApplicationFormData) => void;
  onClose: () => void;
  initialData?: Partial<ApplicationFormData>;
}

const AddApplicationForm: React.FC<AddApplicationFormProps> = ({
  onSubmit,
  onClose,
  initialData
}) => {
  const isOpen = true;
  const [formData, setFormData] = useState<ApplicationFormData>({
    companyName: initialData?.companyName || '',
    positionTitle: initialData?.positionTitle || '',
    location: initialData?.location || '',
    jobUrl: initialData?.jobUrl || '',
    salaryRange: initialData?.salaryRange || '',
    techStack: initialData?.techStack || '',
    visaSponsorship: initialData?.visaSponsorship || false,
    germanRequirement: initialData?.germanRequirement || 'None',
    relocationSupport: initialData?.relocationSupport || false,
    easyApply: initialData?.easyApply || false,
    followupFlagged: initialData?.followupFlagged || false,
    jobBoardSource: initialData?.jobBoardSource || '',
    priorityStars: initialData?.priorityStars || 3,
    notes: initialData?.notes || '',
    referralContactId: initialData?.referralContactId || ''
  });

  const [networkContacts, setNetworkContacts] = useState<NetworkContact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  const germanLevels = ['None', 'Basic', 'Fluent'];
  const jobBoards = ['LinkedIn', 'StepStone', 'Indeed', 'Xing', 'Company Website', 'Referral', 'Other'];

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const contacts = await api.getNetworkContacts();
        setNetworkContacts(contacts);
      } catch (error) {
        console.error('Failed to fetch network contacts:', error);
      }
    };
    fetchContacts();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleStarClick = (stars: number) => {
    setFormData(prev => ({ ...prev, priorityStars: stars }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Briefcase className="w-6 h-6" />
                <h2 className="text-2xl font-bold">{initialData?.companyName ? 'Edit Application' : 'Add New Application'}</h2>
              </div>
              <button
                onClick={onClose}
                className="hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-500" />
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      required
                      placeholder="e.g., SAP, Siemens"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Position Title *
                    </label>
                    <input
                      type="text"
                      name="positionTitle"
                      value={formData.positionTitle}
                      onChange={handleChange}
                      required
                      placeholder="e.g., Full Stack Developer"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location (City) *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        required
                        placeholder="e.g., Berlin, Munich"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Job URL
                    </label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                      <input
                        type="url"
                        name="jobUrl"
                        value={formData.jobUrl}
                        onChange={handleChange}
                        placeholder="https://linkedin.com/jobs/..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Code className="w-5 h-5 text-blue-500" />
                  Job Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Salary Range (EUR)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="salaryRange"
                        value={formData.salaryRange}
                        onChange={handleChange}
                        placeholder="e.g., 60000-80000"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Job Board Source
                    </label>
                    <select
                      name="jobBoardSource"
                      value={formData.jobBoardSource}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select source...</option>
                      {jobBoards.map(board => (
                        <option key={board} value={board}>{board}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                  <input
                    type="checkbox"
                    name="easyApply"
                    checked={formData.easyApply}
                    onChange={handleChange}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <label className="text-sm font-medium text-gray-700 cursor-pointer">Easy Apply</label>
                    <p className="text-xs text-gray-500">Applied via LinkedIn or similar with standard resume, minimal effort</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-amber-300 transition-colors">
                  <input
                    type="checkbox"
                    name="followupFlagged"
                    checked={formData.followupFlagged}
                    onChange={handleChange}
                    className="w-5 h-5 text-amber-600 rounded focus:ring-2 focus:ring-amber-500"
                  />
                  <div>
                    <label className="text-sm font-medium text-gray-700 cursor-pointer">Needs follow-up</label>
                    <p className="text-xs text-gray-500">Adds this role to the followup queue — only flagged roles appear there</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tech Stack
                  </label>
                  <input
                    type="text"
                    name="techStack"
                    value={formData.techStack}
                    onChange={handleChange}
                    placeholder="e.g., React, Python, PostgreSQL, Docker"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-500" />
                  Germany-Specific Requirements
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <input
                      type="checkbox"
                      name="visaSponsorship"
                      checked={formData.visaSponsorship}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium text-gray-700 cursor-pointer">
                      Visa Sponsorship
                    </label>
                  </div>

                  <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <input
                      type="checkbox"
                      name="relocationSupport"
                      checked={formData.relocationSupport}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium text-gray-700 cursor-pointer">
                      Relocation Support
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      German Level Required
                    </label>
                    <select
                      name="germanRequirement"
                      value={formData.germanRequirement}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {germanLevels.map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Star className="w-5 h-5 text-blue-500" />
                  Priority Level
                </h3>

                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleStarClick(star)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 ${star <= formData.priorityStars
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                          }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-600">
                    ({formData.priorityStars} {formData.priorityStars === 1 ? 'star' : 'stars'})
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Referral Contact (Optional)
                </h3>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Got this position through a contact?
                  </label>

                  {formData.referralContactId && networkContacts.find(c => c.id === formData.referralContactId) ? (
                    <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold border border-purple-200">
                          {networkContacts.find(c => c.id === formData.referralContactId)?.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {networkContacts.find(c => c.id === formData.referralContactId)?.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {networkContacts.find(c => c.id === formData.referralContactId)?.company}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, referralContactId: '' }));
                          setContactSearch('');
                        }}
                        className="p-2 hover:bg-purple-100 rounded-full text-gray-500 hover:text-red-500 transition-colors"
                        title="Remove referral"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => {
                          setContactSearch(e.target.value);
                          setShowContactDropdown(true);
                        }}
                        onFocus={() => setShowContactDropdown(true)}
                        placeholder="Search contacts..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {showContactDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          <div
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-600"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, referralContactId: '' }));
                              setContactSearch('');
                              setShowContactDropdown(false);
                            }}
                          >
                            No referral contact
                          </div>
                          {networkContacts
                            .filter(contact =>
                              contact.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                              (contact.company && contact.company.toLowerCase().includes(contactSearch.toLowerCase()))
                            )
                            .map(contact => (
                              <div
                                key={contact.id}
                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, referralContactId: contact.id }));
                                  setContactSearch(contact.name);
                                  setShowContactDropdown(false);
                                }}
                              >
                                <div className="font-medium text-gray-900">{contact.name}</div>
                                {contact.company && (
                                  <div className="text-sm text-gray-500">{contact.company}</div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Add any additional notes, interview impressions, or reminders..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  {initialData?.companyName ? 'Update Application (+1 point)' : 'Add Application (+2 points)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddApplicationForm;