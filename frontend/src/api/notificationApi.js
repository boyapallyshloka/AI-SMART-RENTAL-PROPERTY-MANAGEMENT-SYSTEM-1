import axiosClient from './axiosClient';

// Get all notifications for the logged-in user
// Get all notifications
export const getNotifications = async () => {
    return axiosClient.get('/notifications');
};

// Get unread notifications
export const getUnreadNotifications = async () => {
    return axiosClient.get('/notifications/unread');
};

// Get unread notification count
export const getUnreadCount = async () => {
    return axiosClient.get('/notifications/unread/count');
};

// Mark one notification as read
export const markNotificationAsRead = async (notificationId) => {
    const response = await axiosClient.patch(
        `/notifications/${notificationId}/read`
    );
    return response;
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async () => {
    const response = await axiosClient.patch(
        '/notifications/read-all'
    );
    return response;
};