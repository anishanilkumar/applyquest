import React from 'react';
import toast from 'react-hot-toast';
import { NetworkContact } from '../types';
import { networkService } from '../services/api';
import NetworkList from '../components/network/NetworkList';
import { useAppContext } from '../context/AppContext';

const Network: React.FC = () => {
  const { contacts, setContacts, applications, loading, refreshData } = useAppContext();

  const handleAddContact = async (contactData: Omit<NetworkContact, 'id' | 'userId' | 'createdAt'>) => {
    try {
      const newContact = await networkService.create(contactData);
      setContacts(prev => [...prev, newContact]);
      refreshData();
      toast.success(`Contact added! 🤝\n${contactData.name}`);
    } catch (error) {
      console.error("Failed to create contact:", error);
      toast.error("Failed to create contact. Please try again.");
    }
  };

  const handleEditContact = async (contactId: string, contactData: Omit<NetworkContact, 'id' | 'userId' | 'createdAt'>) => {
    try {
      const updatedContact = await networkService.update(contactId, contactData);
      setContacts(prev =>
        prev.map(contact =>
          contact.id === contactId ? updatedContact : contact
        )
      );
      toast.success('Contact updated successfully.');
    } catch (error) {
      console.error("Failed to update contact:", error);
      toast.error("Failed to update contact. Please try again.");
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      if (window.confirm("Are you sure you want to delete this contact?")) {
        await networkService.delete(contactId);
        setContacts(prev => prev.filter(contact => contact.id !== contactId));
        toast.success('Contact deleted successfully.');
      }
    } catch (error) {
      console.error("Failed to delete contact:", error);
      toast.error("Failed to delete contact. Please try again.");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-ink-dim">Loading network...</div>;
  }

  return (
    <NetworkList
      contacts={contacts}
      applications={applications}
      onAddContact={handleAddContact}
      onEditContact={handleEditContact}
      onDeleteContact={handleDeleteContact}
    />
  );
};

export default Network;