import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import { useAuth } from "./AuthContext";

import {
    getNotifications,
    getUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
} from "../api/notificationApi";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {

    const {
        user,
        loading: authLoading,
    } = useAuth();

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    // -----------------------------------------
    // Fetch all notifications
    // -----------------------------------------
    const fetchNotifications = async () => {
        try {
            setLoading(true);

            const data = await getNotifications();

            console.log("Notifications API response:", data);

            // Backend currently returns an array.
            // This also protects the frontend if the API
            // ever returns null or another unexpected value.
            if (Array.isArray(data)) {
                setNotifications(data);
            } else {
                setNotifications([]);
            }

        } catch (error) {
            console.error(
                "Failed to fetch notifications:",
                error
            );

            setNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    // -----------------------------------------
    // Fetch unread notification count
    // -----------------------------------------
    const fetchUnreadCount = async () => {
        try {
            const data = await getUnreadCount();

            console.log("Unread notification count:", data);

            setUnreadCount(Number(data) || 0);

        } catch (error) {
            console.error(
                "Failed to fetch unread notification count:",
                error
            );

            setUnreadCount(0);
        }
    };

    // -----------------------------------------
    // Refresh notifications + unread count
    // -----------------------------------------
    const refreshNotifications = async () => {
        await Promise.all([
            fetchNotifications(),
            fetchUnreadCount(),
        ]);
    };

    // -----------------------------------------
    // Mark one notification as read
    // -----------------------------------------
    const markAsRead = async (notificationId) => {
        try {
            await markNotificationAsRead(notificationId);

            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) =>
                    notification.notificationId === notificationId
                        ? {
                            ...notification,
                            read: true,
                        }
                        : notification
                )
            );

            setUnreadCount((count) =>
                count > 0 ? count - 1 : 0
            );

        } catch (error) {
            console.error(
                "Failed to mark notification as read:",
                error
            );
        }
    };

    // -----------------------------------------
    // Mark all notifications as read
    // -----------------------------------------
    const markAllAsRead = async () => {
        try {
            await markAllNotificationsAsRead();

            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) => ({
                    ...notification,
                    read: true,
                }))
            );

            setUnreadCount(0);

        } catch (error) {
            console.error(
                "Failed to mark all notifications as read:",
                error
            );
        }
    };

    // -----------------------------------------
    // Load notifications after authentication
    // -----------------------------------------
    useEffect(() => {

        if (!authLoading && user) {
            refreshNotifications();
        }

    }, [authLoading, user]);

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                loading,

                fetchNotifications,
                fetchUnreadCount,
                refreshNotifications,

                markAsRead,
                markAllAsRead,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

// -----------------------------------------
// Custom notification hook
// -----------------------------------------
export const useNotifications = () => {

    const context = useContext(NotificationContext);

    if (!context) {
        throw new Error(
            "useNotifications must be used inside NotificationProvider"
        );
    }

    return context;
};