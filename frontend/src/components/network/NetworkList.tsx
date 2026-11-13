import React, { useState } from 'react';
import { NetworkContact, JobApplication } from '../../types';
import NetworkContactCard from './NetworkContactCard';
import AddNetworkContactForm from './AddNetworkContactForm';
import { Plus, Search } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

interface NetworkListProps {
  contacts: NetworkContact[];
  applications?: JobApplication[];
  onAddContact: (contact: Omit<NetworkContact, 'id' | 'userId' | 'createdAt'>) => void;
  onEditContact: (contactId: string, contact: Omit<NetworkContact, 'id' | 'userId' | 'createdAt'>) => void;
  onDeleteContact: (contactId: string) => void;
}

const NetworkList: React.FC<NetworkListProps> = ({
  contacts,
  applications = [],
  onAddContact,
  onEditContact,
  onDeleteContact
}) => {
  const { isMentorView } = useAppContext();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<NetworkContact | undefined>();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.relationship?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (contact: NetworkContact) => {
    setEditingContact(contact);
    setIsFormOpen(true);
  };

  const handleDelete = (contactId: string) => {
    if (window.confirm('Are you sure you want to delete this network contact?')) {
      onDeleteContact(contactId);
    }
  };

  const handleSave = (contactData: Omit<NetworkContact, 'id' | 'userId' | 'createdAt'>) => {
    if (editingContact) {
      onEditContact(editingContact.id, contactData);
      setEditingContact(undefined);
    } else {
      onAddContact(contactData);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingContact(undefined);
  };

  const getStats = () => {
    const totalContacts = contacts.length;
    const strongConnections = contacts.filter(c => c.connectionStrength >= 4).length;
    const recentContacts = contacts.filter(c => {
      if (!c.lastContactDate) return false;
      const lastContact = new Date(c.lastContactDate);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return lastContact >= thirtyDaysAgo;
    }).length;

    return { totalContacts, strongConnections, recentContacts };
  };

  const stats = getStats();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label">Network</span>
          <h1 className="major mt-1">{stats.totalContacts} contacts</h1>
        </div>
        {!isMentorView && (
          <button onClick={() => setIsFormOpen(true)} className="btn btn-primary">
            <Plus className="w-5 h-5" strokeWidth={1.6} />
            Add contact
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[['Contacts', stats.totalContacts, 'text-ink'], ['Strong (4-5)', stats.strongConnections, 'text-arc'], ['Contacted in 30 days', stats.recentContacts, 'text-ink']].map(([label, n, tone]) => (
          <div key={label as string} className="instrument">
            <span className="label">{label}</span>
            <p className={`readout mt-2 ${tone}`}>{n}</p>
          </div>
        ))}
      </div>

      <div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate" strokeWidth={1.6} />
          <input
            type="text"
            placeholder="Search contacts by name, company, email, or relationship..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-full pl-10 pr-4"
          />
        </div>
      </div>

      {/* Contacts Grid */}
      {filteredContacts.length === 0 ? (
        <div className="instrument empty">
          <h3 className="empty-title">
            {contacts.length === 0 ? 'No contacts yet' : 'Nothing matches'}
          </h3>
          <p className="text-ink-dim mb-4">
            {contacts.length === 0
              ? 'Start building your professional network by adding contacts who can help with your job search.'
              : 'Try adjusting your search terms.'
            }
          </p>
          {contacts.length === 0 && !isMentorView && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="btn btn-primary"
            >
              <Plus className="w-5 h-5" />
              Add a contact
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContacts.map(contact => (
            <NetworkContactCard
              key={contact.id}
              contact={contact}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      <AddNetworkContactForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSave}
        contact={editingContact}
        applications={applications}
      />
    </div>
  );
};

export default NetworkList;