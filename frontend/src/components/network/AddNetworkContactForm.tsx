import React, { useState, useEffect } from 'react';
import { X, User, Mail, Building, Users, Calendar, Star, Link2 } from 'lucide-react';
import { NetworkContact, JobApplication } from '../../types';

interface NetworkContactFormData {
  name: string;
  email: string;
  company: string;
  relationship: string;
  connectionStrength: number;
  lastContactDate: string;
  notes: string;
  applicationId: string;
}

interface AddNetworkContactFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contact: Omit<NetworkContact, 'id' | 'userId' | 'createdAt'>) => void;
  contact?: NetworkContact;
  applications?: JobApplication[];
}

const AddNetworkContactForm: React.FC<AddNetworkContactFormProps> = ({
  isOpen,
  onClose,
  onSave,
  contact,
  applications = []
}) => {
  const [formData, setFormData] = useState<NetworkContactFormData>({
    name: '',
    email: '',
    company: '',
    relationship: '',
    connectionStrength: 3,
    lastContactDate: new Date().toISOString().split('T')[0],
    notes: '',
    applicationId: ''
  });

  const relationships = [
    'Former Colleague',
    'Current Colleague',
    'Mentor',
    'Mentee',
    'Friend',
    'Family',
    'Alumni',
    'Industry Contact',
    'Client',
    'Supplier',
    'Conference Contact',
    'LinkedIn Connection',
    'Referral Source',
    'Other'
  ];

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name,
        email: contact.email || '',
        company: contact.company || '',
        relationship: contact.relationship || '',
        connectionStrength: contact.connectionStrength,
        lastContactDate: contact.lastContactDate || new Date().toISOString().split('T')[0],
        notes: contact.notes || '',
        applicationId: contact.applicationId || ''
      });
    } else {
      setFormData({
        name: '',
        email: '',
        company: '',
        relationship: '',
        connectionStrength: 3,
        lastContactDate: new Date().toISOString().split('T')[0],
        notes: '',
        applicationId: ''
      });
    }
  }, [contact, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStarClick = (strength: number) => {
    setFormData(prev => ({ ...prev, connectionStrength: strength }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const contactData: Omit<NetworkContact, 'id' | 'userId' | 'createdAt'> = {
      name: formData.name,
      email: formData.email || undefined,
      company: formData.company || undefined,
      relationship: formData.relationship || undefined,
      connectionStrength: formData.connectionStrength,
      lastContactDate: formData.lastContactDate || undefined,
      notes: formData.notes || undefined,
      applicationId: formData.applicationId || undefined
    };

    onSave(contactData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-ground/[0.82] flex items-center justify-center z-50 p-4">
      <div className="bg-panel border-2 border-engrave w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-panel px-6 min-h-[64px] flex items-center justify-between border-b-2 border-engrave">
          <div className="flex items-center gap-3">
            <h2 className="label">
              {contact ? 'Edit Network Contact' : 'Add Network Contact'}
            </h2>
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
              <User className="w-4 h-4" strokeWidth={1.6} />
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="field-label">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g., John Smith"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="field-label">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-5 h-5 text-slate" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    className="input w-full pl-10 pr-4"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">
                  Company
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 w-5 h-5 text-slate" />
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="e.g., SAP, Siemens"
                    className="input w-full pl-10 pr-4"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">
                  Relationship
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 w-5 h-5 text-slate" />
                  <select
                    name="relationship"
                    value={formData.relationship}
                    onChange={handleChange}
                    className="input w-full pl-10 pr-4"
                  >
                    <option value="">Select relationship...</option>
                    {relationships.map(rel => (
                      <option key={rel} value={rel}>{rel}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="label flex items-center gap-2 border-b-2 border-engrave pb-2">
              <Star className="w-4 h-4" strokeWidth={1.6} />
              Connection Strength
            </h3>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleStarClick(star)}
                    className="w-11 h-11 inline-flex items-center justify-center" aria-label={`${star} of 5`}
                    >
                      {/* Lit squares, not stars: the house mark for a 1-5 judgement. */}
                      <i className={`block w-5 h-5 ${star <= formData.connectionStrength ? 'bg-gold' : 'border-2 border-slate'}`} />
                  </button>
                ))}
              </div>
              <span className="text-sm text-ink-dim">
                {formData.connectionStrength} of 5
              </span>
            </div>

            <div className="text-sm text-ink-dim bg-panel-lit p-3 rounded-lg">
              <strong>Rating Guide:</strong><br />
              1 star = Very Weak (just met, no real connection)<br />
              2 stars = Weak (basic acquaintance)<br />
              3 stars = Moderate (professional contact)<br />
              4 stars = Strong (good working relationship)<br />
              5 stars = Very Strong (close professional/personal relationship)
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="label flex items-center gap-2 border-b-2 border-engrave pb-2">
              <Calendar className="w-4 h-4" strokeWidth={1.6} />
              Last Contact
            </h3>

            <div>
              <label className="field-label">
                When did you last contact this person?
              </label>
              <input
                type="date"
                name="lastContactDate"
                value={formData.lastContactDate}
                onChange={handleChange}
                className="input w-full"
              />
            </div>
          </div>

          {applications.length > 0 && (
            <div className="space-y-4">
              <h3 className="label flex items-center gap-2 border-b-2 border-engrave pb-2">
                <Link2 className="w-4 h-4" strokeWidth={1.6} />
                Link to Application (Optional)
              </h3>

              <div>
                <label className="field-label">
                  Connect this contact to a job application
                </label>
                <select
                  name="applicationId"
                  value={formData.applicationId}
                  onChange={handleChange}
                  className="input w-full"
                >
                  <option value="">No application linked</option>
                  {applications.map(app => (
                    <option key={app.id} value={app.id}>
                      {app.companyName} - {app.positionTitle}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <label className="field-label">
              Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Add any additional notes about this contact, shared interests, or conversation topics..."
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
              {contact ? 'Update Contact' : 'Add Contact (+5 points)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddNetworkContactForm;