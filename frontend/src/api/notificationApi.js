import axiosClient from './axiosClient';

// axiosClient unwraps the HTTP response; callers normalize API payload shapes.
export const getNotifications = () => axiosClient.get('/notifications');

// Get unread notifications
export const getUnreadNotifications = () => axiosClient.get('/notifications/unread');

// Get unread notification count
export const getUnreadCount = () => axiosClient.get('/notifications/unread/count');

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
