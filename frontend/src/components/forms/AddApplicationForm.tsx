import React, { useState, useEffect } from 'react';
import { X, MapPin, DollarSign, Code, Star, Link2, Globe, Building, Users } from 'lucide-react';
import { api } from '../../services/api';
import type { ApplicationEffort, NetworkContact } from '../../types';
import { EFFORTS, EFFORT_DESCRIPTION } from '../../utils/effort';

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
  effort: ApplicationEffort;
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
    effort: initialData?.effort || 'Unknown',
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
        <div className="fixed inset-0 bg-ground/[0.82] flex items-center justify-center z-50 p-4">
          <div className="bg-panel border-2 border-engrave w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-panel px-6 min-h-[64px] flex items-center justify-between border-b-2 border-engrave">
              <div className="flex items-center gap-3">
                <h2 className="label">{initialData?.companyName ? 'Edit Application' : 'Add New Application'}</h2>
              </div>
              <button
                onClick={onClose}
                className="btn-icon btn btn-quiet border-transparent transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={1.6} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="label flex items-center gap-2 border-b-2 border-engrave pb-2">
                  <Building className="w-4 h-4" strokeWidth={1.6} />
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      required
                      placeholder="e.g., SAP, Siemens"
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="field-label">
                      Position Title *
                    </label>
                    <input
                      type="text"
                      name="positionTitle"
                      value={formData.positionTitle}
                      onChange={handleChange}
                      required
                      placeholder="e.g., Full Stack Developer"
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="field-label">
                      Location (City) *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-slate" />
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        required
                        placeholder="e.g., Berlin, Munich"
                        className="input w-full pl-10 pr-4"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="field-label">
                      Job URL
                    </label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-2.5 w-5 h-5 text-slate" />
                      <input
                        type="url"
                        name="jobUrl"
                        value={formData.jobUrl}
                        onChange={handleChange}
                        placeholder="https://linkedin.com/jobs/..."
                        className="input w-full pl-10 pr-4"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="label flex items-center gap-2 border-b-2 border-engrave pb-2">
                  <Code className="w-4 h-4" strokeWidth={1.6} />
                  Job Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">
                      Salary Range (EUR)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 w-5 h-5 text-slate" />
                      <input
                        type="text"
                        name="salaryRange"
                        value={formData.salaryRange}
                        onChange={handleChange}
                        placeholder="e.g., 60000-80000"
                        className="input w-full pl-10 pr-4"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="field-label">
                      Job Board Source
                    </label>
                    <select
                      name="jobBoardSource"
                      value={formData.jobBoardSource}
                      onChange={handleChange}
                      className="input w-full"
                    >
                      <option value="">Select source...</option>
                      {jobBoards.map(board => (
                        <option key={board} value={board}>{board}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-4 border border-engrave rounded-lg hover:border-arc-dim transition-colors">
                  <label className="field-label">Effort</label>
                  <select
                    name="effort"
                    value={formData.effort}
                    onChange={handleChange}
                    className="input w-full"
                  >
                    {EFFORTS.map(effort => (
                      <option key={effort} value={effort}>{effort}</option>
                    ))}
                  </select>
                  <p className="text-xs text-ink-dim mt-1">{EFFORT_DESCRIPTION[formData.effort]}</p>
                </div>

                <div>
                  <label className="field-label">
                    Tech Stack
                  </label>
                  <input
                    type="text"
                    name="techStack"
                    value={formData.techStack}
                    onChange={handleChange}
                    placeholder="e.g., React, Python, PostgreSQL, Docker"
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="label flex items-center gap-2 border-b-2 border-engrave pb-2">
                  <Globe className="w-4 h-4" strokeWidth={1.6} />
                  Germany-Specific Requirements
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 border border-engrave rounded-lg hover:border-arc-dim transition-colors">
                    <input
                      type="checkbox"
                      name="visaSponsorship"
                      checked={formData.visaSponsorship}
                      onChange={handleChange}
                      className="w-5 h-5 text-arc rounded"
                    />
                    <label className="text-sm font-medium text-ink cursor-pointer">
                      Visa Sponsorship
                    </label>
                  </div>

                  <div className="flex items-center gap-3 p-4 border border-engrave rounded-lg hover:border-arc-dim transition-colors">
                    <input
                      type="checkbox"
                      name="relocationSupport"
                      checked={formData.relocationSupport}
                      onChange={handleChange}
                      className="w-5 h-5 text-arc rounded"
                    />
                    <label className="text-sm font-medium text-ink cursor-pointer">
                      Relocation Support
                    </label>
                  </div>

                  <div>
                    <label className="field-label">
                      German Level Required
                    </label>
                    <select
                      name="germanRequirement"
                      value={formData.germanRequirement}
                      onChange={handleChange}
                      className="input w-full"
                    >
                      {germanLevels.map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="label flex items-center gap-2 border-b-2 border-engrave pb-2">
                  <Star className="w-4 h-4" strokeWidth={1.6} />
                  Priority Level
                </h3>

                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleStarClick(star)}
                      className="w-11 h-11 inline-flex items-center justify-center" aria-label={`${star} of 5`}
                    >
                      {/* Lit squares, not stars: the house mark for a 1-5 judgement. */}
                      <i className={`block w-5 h-5 ${star <= formData.priorityStars ? 'bg-gold' : 'border-2 border-slate'}`} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-ink-dim">
                    {formData.priorityStars} of 5
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="label flex items-center gap-2 border-b-2 border-engrave pb-2">
                  <Users className="w-4 h-4" strokeWidth={1.6} />
                  Referral Contact (Optional)
                </h3>
                <div className="relative">
                  <label className="field-label">
                    Got this position through a contact?
                  </label>

                  {formData.referralContactId && networkContacts.find(c => c.id === formData.referralContactId) ? (
                    <div className="flex items-center justify-between p-3 bg-panel-lit border border-engrave rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-panel-lit flex items-center justify-center text-arc-dim font-bold border border-engrave">
                          {networkContacts.find(c => c.id === formData.referralContactId)?.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-ink">
                            {networkContacts.find(c => c.id === formData.referralContactId)?.name}
                          </div>
                          <div className="text-sm text-ink-dim">
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
                        className="p-2 hover:bg-panel-lit rounded-full text-ink-dim hover:text-alert transition-colors"
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
                        className="input w-full"
                      />
                      {showContactDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-ground border-2 border-engrave max-h-48 overflow-y-auto">
                          <div
                            className="px-4 py-2 hover:bg-panel-lit cursor-pointer text-sm text-ink-dim"
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
                                className="px-4 py-2 hover:bg-panel-lit cursor-pointer border-b border-engrave last:border-b-0"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, referralContactId: contact.id }));
                                  setContactSearch(contact.name);
                                  setShowContactDropdown(false);
                                }}
                              >
                                <div className="font-medium text-ink">{contact.name}</div>
                                {contact.company && (
                                  <div className="text-sm text-ink-dim">{contact.company}</div>
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
                <label className="field-label">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Add any additional notes, interview impressions, or reminders..."
                  className="input w-full"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="btn btn-primary flex-1"
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