import axiosClient from "./axiosClient";

// Get all notifications
export const getNotifications = async () => {
    return await axiosClient.get("/notifications");
};

// Get unread notifications
export const getUnreadNotifications = async () => {
    return await axiosClient.get("/notifications/unread");
};

// Get unread count
export const getUnreadCount = async () => {
    return await axiosClient.get("/notifications/unread/count");
};

// Mark one notification as read
export const markNotificationAsRead = async (notificationId) => {
    return await axiosClient.patch(
        `/notifications/${notificationId}/read`
    );
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async () => {
    return await axiosClient.patch(
        "/notifications/read-all"
    );
};