import axios from 'axios';
import { User, JobApplication, NetworkContact, ApplicationStatus } from '../types';

const API_URL = '/api/v1';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to include the auth token
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Helper to transform snake_case to camelCase
const transformUser = (data: any): User => ({
    id: data.id,
    name: data.name,
    email: data.email,
    currentEducation: data.current_education,
    germanLevel: data.german_level,
    currentRole: data.current_role,
    points: data.points,
    level: data.level,
    levelName: data.level_name,
    currentStreak: data.current_streak,
    longestStreak: data.longest_streak,
    createdAt: data.created_at,
});

const transformApplication = (data: any): JobApplication => ({
    id: data.id,
    userId: data.user_id,
    companyName: data.company_name,
    positionTitle: data.position_title,
    location: data.location,
    jobUrl: data.job_url,
    salaryRange: data.salary_range,
    techStack: data.tech_stack,
    status: data.status,
    visaSponsorship: data.visa_sponsorship,
    germanRequirement: data.german_requirement,
    relocationSupport: data.relocation_support,
    easyApply: data.easy_apply,
    jobBoardSource: data.job_board_source,
    priorityStars: data.priority_stars,
    notes: data.notes,
    appliedDate: data.applied_date,
    followedUpAt: data.followed_up_at ?? undefined,
    followupFlagged: data.followup_flagged ?? false,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    referralContactId: data.referral_contact_id,
    history: data.history ? data.history.map((h: any) => ({
        id: h.id,
        applicationId: h.application_id,
        oldStatus: h.old_status,
        newStatus: h.new_status,
        notes: h.notes,
        changedAt: h.changed_at,
    })) : [],
});

const transformNetworkContact = (data: any): NetworkContact => ({
    id: data.id,
    userId: data.user_id,
    name: data.name,
    email: data.email,
    company: data.company,
    relationship: data.relationship_type,
    connectionStrength: data.connection_strength,
    lastContactDate: data.last_contact_date,
    notes: data.notes,
    applicationId: data.application_id,
    createdAt: data.created_at,
});

// Helper to transform camelCase to snake_case for sending data
const toSnakeCase = (data: any): any => {
    const result: any = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            result[snakeKey] = data[key];
        }
    }
    // Specific overrides for mismatches mostly handled by generic converter but relationship differs
    if (data.relationship) {
        result.relationship_type = data.relationship;
        delete result.relationship;
    }
    return result;
};


export const userService = {
    login: async (username: string, password: string): Promise<string> => {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        const response = await apiClient.post('/access-token', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data.access_token;
    },
    getCurrentUser: async (): Promise<User> => {
        const response = await apiClient.get('/user/');
        return transformUser(response.data);
    },
    updateUser: async (userData: Partial<User>): Promise<User> => {
        const response = await apiClient.put('/user/', toSnakeCase(userData));
        return transformUser(response.data);
    },
    claimDailyGoalBonus: async (): Promise<User> => {
        const response = await apiClient.post('/user/daily-goal-bonus');
        return transformUser(response.data);
    },
};

export const applicationService = {
    getAll: async (): Promise<JobApplication[]> => {
        const response = await apiClient.get('/applications/');
        return response.data.map(transformApplication);
    },
    create: async (applicationData: Partial<JobApplication>): Promise<JobApplication> => {
        const response = await apiClient.post('/applications/', toSnakeCase(applicationData));
        return transformApplication(response.data);
    },
    update: async (id: string, applicationData: Partial<JobApplication>): Promise<JobApplication> => {
        const response = await apiClient.put(`/applications/${id}`, toSnakeCase(applicationData));
        return transformApplication(response.data);
    },
    updateStatus: async (id: string, status: ApplicationStatus, notes?: string): Promise<JobApplication> => {
        const response = await apiClient.patch(`/applications/${id}/status`, {
            new_status: status, // Matches Body(embed=True)
            notes: notes,
        });
        return transformApplication(response.data);
    },
    markFollowedUp: async (id: string): Promise<JobApplication> => {
        const response = await apiClient.post(`/applications/${id}/followup`);
        return transformApplication(response.data);
    },
    setFollowupFlag: async (id: string, flagged: boolean): Promise<JobApplication> => {
        const response = await apiClient.post(`/applications/${id}/followup-flag`, { flagged });
        return transformApplication(response.data);
    },
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/applications/${id}`);
    },
};

export const networkService = {
    getAll: async (): Promise<NetworkContact[]> => {
        const response = await apiClient.get('/network/');
        return response.data.map(transformNetworkContact);
    },
    create: async (contactData: Partial<NetworkContact>): Promise<NetworkContact> => {
        const response = await apiClient.post('/network/', toSnakeCase(contactData));
        return transformNetworkContact(response.data);
    },
    update: async (id: string, contactData: Partial<NetworkContact>): Promise<NetworkContact> => {
        const response = await apiClient.put(`/network/${id}`, toSnakeCase(contactData));
        return transformNetworkContact(response.data);
    },
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/network/${id}`);
    },
};


export const shareService = {
    getData: async (password: string): Promise<{ user: User; applications: any[]; contacts: any[] }> => {
        const response = await apiClient.post('/share/data', { password });
        return {
            user: transformUser(response.data.user),
            applications: response.data.applications.map(transformApplication),
            contacts: response.data.contacts.map(transformNetworkContact),
        };
    },
};

// Unified API export
export const api = {
    getUser: userService.getCurrentUser,
    updateUser: userService.updateUser,
    getApplications: applicationService.getAll,
    createApplication: applicationService.create,
    updateApplication: applicationService.update,
    updateApplicationStatus: applicationService.updateStatus,
    deleteApplication: applicationService.delete,
    getNetworkContacts: networkService.getAll,
    createNetworkContact: networkService.create,
    updateNetworkContact: networkService.update,
    deleteNetworkContact: networkService.delete,
};
