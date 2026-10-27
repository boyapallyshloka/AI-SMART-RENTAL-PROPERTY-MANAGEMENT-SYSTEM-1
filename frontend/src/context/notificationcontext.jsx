import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
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

    // Fetch all notifications
    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);

            const data = await getNotifications();
            console.log("Notifications returned to context:", data);

            setNotifications(
                Array.isArray(data) ? data : []
            );
        } catch (error) {
            console.error(
                "Failed to fetch notifications:",
                error
            );
        } finally {
            setLoading(false);
        }
    }, []);


    // Fetch unread notification count
    const fetchUnreadCount = useCallback(async () => {
        try {
            const data = await getUnreadCount();
            console.log("unread count returned to context:", data);

            setUnreadCount(Number(data) || 0);
        } catch (error) {
            console.error(
                "Failed to fetch unread notification count:",
                error
            );
        }
    }, []);

    // Refresh notifications and unread count
    const refreshNotifications = useCallback(async () => {
        await Promise.all([
            fetchNotifications(),
            fetchUnreadCount(),
        ]);
    }, [fetchNotifications, fetchUnreadCount]);

    // Mark one notification as read
    const markAsRead = async (notificationId) => {
        try {
            await markNotificationAsRead(notificationId);

            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) =>
                    notification.notificationId === notificationId
                        ? { ...notification, read: true }
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

    // Mark all notifications as read
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

    // Automatically refresh after authentication
    useEffect(() => {
        if (authLoading || !user) {
            return;
        }

        refreshNotifications();

        const intervalId = setInterval(() => {
            refreshNotifications();
        }, 10000);

        const handleFocus = () => {
            refreshNotifications();
        };

        window.addEventListener("focus", handleFocus);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener("focus", handleFocus);
        };
    }, [authLoading, user, refreshNotifications]);

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

// Keep this hook OUTSIDE NotificationProvider
export const useNotifications = () => {
    const context = useContext(NotificationContext);

    if (!context) {
        throw new Error(
            "useNotifications must be used inside NotificationProvider"
        );
    }

    return context;
};