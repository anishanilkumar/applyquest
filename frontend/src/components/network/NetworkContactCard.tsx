import React from 'react';
import { NetworkContact } from '../../types';
import { Mail, Building, Calendar, Edit2, Trash2 } from 'lucide-react';
import { Priority } from '../common/Marks';
import { useAppContext } from '../../context/AppContext';

interface NetworkContactCardProps {
  contact: NetworkContact;
  onEdit: (contact: NetworkContact) => void;
  onDelete: (contactId: string) => void;
}

const NetworkContactCard: React.FC<NetworkContactCardProps> = ({ contact, onEdit, onDelete }) => {
  const { isMentorView } = useAppContext();
  const getConnectionStrengthColor = (strength: number) => {
    if (strength >= 4) return 'text-arc';
    if (strength >= 3) return 'text-gold';
    return 'text-ink-dim';
  };

  const getConnectionStrengthLabel = (strength: number) => {
    if (strength >= 5) return 'Very Strong';
    if (strength >= 4) return 'Strong';
    if (strength >= 3) return 'Moderate';
    if (strength >= 2) return 'Weak';
    return 'Very Weak';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="instrument !p-0 hover:bg-panel-lit transition-colors">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="font-semibold text-ink">{contact.name}</h3>
              {contact.relationship && (
                <p className="text-sm text-ink-dim">{contact.relationship}</p>
              )}
            </div>
          </div>
          {!isMentorView && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(contact)}
                className="btn btn-quiet btn-icon border-transparent hover:text-arc"
                title="Edit contact"
              >
                <Edit2 className="w-4 h-4" strokeWidth={1.6} />
              </button>
              <button
                onClick={() => onDelete(contact.id)}
                className="btn btn-quiet btn-icon border-transparent hover:text-alert"
                title="Delete contact"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.6} />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-ink-dim">
            <Mail className="w-4 h-4" />
            <span>{contact.email || 'No email'}</span>
          </div>

          {contact.company && (
            <div className="flex items-center gap-3 text-sm text-ink-dim">
              <Building className="w-4 h-4" />
              <span>{contact.company}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-slate" />
            <span className="text-ink-dim">Last contact: {formatDate(contact.lastContactDate)}</span>
          </div>

          <div className="flex items-center gap-3">
            <Priority value={contact.connectionStrength} />
            <span className={`text-sm font-medium ${getConnectionStrengthColor(contact.connectionStrength)}`}>
              {getConnectionStrengthLabel(contact.connectionStrength)}
            </span>
          </div>

          {contact.notes && (
            <div className="mt-4 p-3 bg-panel-lit rounded-lg">
              <p className="text-sm text-ink">{contact.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkContactCard;