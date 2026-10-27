
import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
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
    const [error, setError] = useState("");
    const inFlightRefreshRef = useRef(null);
    const activeUserKey = user?.userId ?? user?.id ?? user?.email ?? null;
    const activeUserKeyRef = useRef(activeUserKey);
    activeUserKeyRef.current = activeUserKey;
    const previousUserKeyRef = useRef(activeUserKey);

    // Fetch all notifications
    const fetchNotifications = useCallback(async (requestUserKey = activeUserKeyRef.current) => {
        try {
            if (activeUserKeyRef.current === requestUserKey) {
                setLoading(true);
            }

            const data = await getNotifications();

            if (activeUserKeyRef.current === requestUserKey) {
                setNotifications(
                    Array.isArray(data)
                        ? data
                        : Array.isArray(data?.data)
                            ? data.data
                            : []
                );
            }
        } catch (error) {
            if (activeUserKeyRef.current === requestUserKey) {
                setError(error?.message || "Unable to load notifications.");
            }
            console.error(
                "Failed to fetch notifications:",
                error
            );
        } finally {
            if (activeUserKeyRef.current === requestUserKey) {
                setLoading(false);
            }
        }
    }, []);


    // Fetch unread notification count
    const fetchUnreadCount = useCallback(async (requestUserKey = activeUserKeyRef.current) => {
        try {
            const data = await getUnreadCount();

            if (activeUserKeyRef.current === requestUserKey) {
                setUnreadCount(Number(data?.count ?? data) || 0);
            }
        } catch (error) {
            if (activeUserKeyRef.current === requestUserKey) {
                setError(error?.message || "Unable to load unread notification count.");
            }
            console.error(
                "Failed to fetch unread notification count:",
                error
            );
        }
    }, []);

    // Refresh notifications and unread count
    const refreshNotifications = useCallback(async () => {
        const userKey = activeUserKey;
        if (userKey == null) {
            return;
        }
        const activeRefresh = inFlightRefreshRef.current;
        if (activeRefresh?.userKey === userKey) {
            return activeRefresh.promise;
        }

        setError("");
        const refreshPromise = Promise.all([
            fetchNotifications(userKey),
            fetchUnreadCount(userKey),
        ]);
        inFlightRefreshRef.current = {
            userKey,
            promise: refreshPromise,
        };

        try {
            await refreshPromise;
        } finally {
            if (inFlightRefreshRef.current?.promise === refreshPromise) {
                inFlightRefreshRef.current = null;
            }
        }
    }, [activeUserKey, fetchNotifications, fetchUnreadCount]);

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
            setError(error?.message || "Unable to mark notification as read.");
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
            setError(error?.message || "Unable to mark notifications as read.");
            console.error(
                "Failed to mark all notifications as read:",
                error
            );
        }
    };

    // Automatically refresh after authentication
    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (previousUserKeyRef.current !== activeUserKey) {
            previousUserKeyRef.current = activeUserKey;
            setNotifications([]);
            setUnreadCount(0);
            setError("");
            inFlightRefreshRef.current = null;
        }

        if (!user) {
            setLoading(false);
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
                error,
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
