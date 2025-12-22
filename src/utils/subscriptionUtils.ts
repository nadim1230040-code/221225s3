
import { User, ContentType } from '../types';

export const isSubscriptionActive = (user: User | null): boolean => {
    if (!user) return false;
    
    // Admin always active
    if (user.role === 'admin') return true;
    
    // Check Expiry Date
    if (user.subscriptionEndDate) {
        const expiry = new Date(user.subscriptionEndDate).getTime();
        if (expiry > Date.now()) {
            return true;
        }
    }
    
    // Check Lifetime
    if (user.subscriptionTier === 'LIFETIME') return true;
    
    return false;
};

export const getSubscriptionAccessLevel = (user: User | null): 'NONE' | 'BASIC' | 'ULTRA' => {
    if (!isSubscriptionActive(user)) return 'NONE';
    
    const tier = user?.subscriptionTier;
    if (tier === 'WEEKLY' || tier === 'MONTHLY') return 'BASIC'; // Basic: MCQ + Notes
    if (tier === 'YEARLY' || tier === 'LIFETIME') return 'ULTRA'; // Ultra: PDF + Video
    
    return 'NONE';
};

export const canAccessContent = (user: User | null, contentType: ContentType): boolean => {
    if (user?.role === 'admin') return true;
    
    // Always allow Free content
    if (contentType === 'PDF_FREE' || contentType === 'NOTES_SIMPLE') return true;

    const access = getSubscriptionAccessLevel(user);
    
    // Basic Access: Premium Notes & MCQs
    if (['NOTES_PREMIUM', 'MCQ_SIMPLE', 'MCQ_ANALYSIS', 'WEEKLY_TEST'].includes(contentType)) {
        if (access === 'BASIC' || access === 'ULTRA') return true;
    }
    
    // Ultra Access: Premium PDF & Videos
    if (['PDF_PREMIUM', 'PDF_VIEWER'].includes(contentType)) { 
        if (access === 'ULTRA') return true;
    }
    
    return false;
};

export const getDaysRemaining = (user: User): number => {
    if (user.subscriptionTier === 'LIFETIME') return 9999;
    if (!user.subscriptionEndDate) return 0;
    
    const diff = new Date(user.subscriptionEndDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};
