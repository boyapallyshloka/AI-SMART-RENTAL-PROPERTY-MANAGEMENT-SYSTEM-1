import axiosClient from './axiosClient';

// Get all notifications for the logged-in user
// Get all notifications
export const getNotifications = async () => {
    const response = await axiosClient.get('/notifications');
    return response.data;
};

// Get unread notifications
export const getUnreadNotifications = async () => {
    const response = await axiosClient.get('/notifications/unread');
    return response.data;
};

// Get unread notification count
export const getUnreadCount = async () => {
    const response = await axiosClient.get('/notifications/unread/count');
    return response.data;
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