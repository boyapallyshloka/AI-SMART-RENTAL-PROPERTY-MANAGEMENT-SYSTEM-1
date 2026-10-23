package com.rental.rental_management_backend.notification.serviceImpl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.notification.dto.NotificationResponse;
import com.rental.rental_management_backend.notification.entity.Notification;
import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;
import com.rental.rental_management_backend.notification.repository.NotificationRepository;
import com.rental.rental_management_backend.notification.service.NotificationSseService;

@ExtendWith(MockitoExtension.class)
class NotificationServiceImplTest {

    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationSseService notificationSseService;

    @InjectMocks
    private NotificationServiceImpl notificationService;

    private User owner;
    private Notification notification;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(12L);
        owner.setEmail("owner@example.test");
        owner.setRole(RoleType.PROPERTY_OWNER);

        notification = new Notification(
                owner,
                NotificationType.PROPERTY_APPROVED,
                NotificationPriority.HIGH,
                "Property approved",
                "Property Cottage (ID: 72) has been approved.",
                72L,
                "PROPERTY",
                false);
        notification.setNotificationId(31L);

        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(
                        owner.getEmail(), "password", List.of()));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createNotificationOncePersistsAndDoesNotDuplicateOrRedeliver() {
        when(userRepository.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(notificationRepository.findByDeduplicationKey(
                "property-approved-72"))
                .thenReturn(Optional.empty());
        when(notificationRepository.insertIfDeduplicationKeyAbsent(
                owner.getId(),
                NotificationType.PROPERTY_APPROVED.name(),
                NotificationPriority.HIGH.name(),
                "Property approved",
                "Property Cottage (ID: 72) has been approved.",
                72L,
                "PROPERTY",
                "12:property-approved-72"))
                .thenReturn(1, 0);
        when(notificationRepository.findByDeduplicationKey(
                "12:property-approved-72"))
                .thenReturn(Optional.of(notification));

        notificationService.notifyUserOnce(
                owner.getId(),
                NotificationType.PROPERTY_APPROVED,
                NotificationPriority.HIGH,
                "Property approved",
                "Property Cottage (ID: 72) has been approved.",
                72L,
                "PROPERTY",
                "property-approved-72");
        notificationService.notifyUserOnce(
                owner.getId(),
                NotificationType.PROPERTY_APPROVED,
                NotificationPriority.HIGH,
                "Property approved",
                "Property Cottage (ID: 72) has been approved.",
                72L,
                "PROPERTY",
                "property-approved-72");

        verify(notificationRepository, times(2))
                .insertIfDeduplicationKeyAbsent(
                        owner.getId(),
                        NotificationType.PROPERTY_APPROVED.name(),
                        NotificationPriority.HIGH.name(),
                        "Property approved",
                        "Property Cottage (ID: 72) has been approved.",
                        72L,
                        "PROPERTY",
                        "12:property-approved-72");
        verify(notificationSseService, times(1)).sendNotification(
                org.mockito.ArgumentMatchers.eq(owner.getId()),
                any(NotificationResponse.class));
    }

    @Test
    void databaseDeduplicationConflictReturnsExistingNotificationWithoutRedelivery() {
        when(userRepository.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(notificationRepository.findByDeduplicationKey(
                "property-approved-72"))
                .thenReturn(Optional.empty());
        when(notificationRepository.insertIfDeduplicationKeyAbsent(
                owner.getId(),
                NotificationType.PROPERTY_APPROVED.name(),
                NotificationPriority.HIGH.name(),
                "Property approved",
                "Property Cottage (ID: 72) has been approved.",
                72L,
                "PROPERTY",
                "12:property-approved-72"))
                .thenReturn(0);
        when(notificationRepository.findByDeduplicationKey(
                "12:property-approved-72"))
                .thenReturn(Optional.of(notification));

        notificationService.notifyUserOnce(
                owner.getId(),
                NotificationType.PROPERTY_APPROVED,
                NotificationPriority.HIGH,
                "Property approved",
                "Property Cottage (ID: 72) has been approved.",
                72L,
                "PROPERTY",
                "property-approved-72");

        verify(notificationSseService, org.mockito.Mockito.never())
                .sendNotification(any(), any(NotificationResponse.class));
    }

    @Test
    void existingUnscopedNotificationForSameRecipientRemainsDeduplicated() {
        when(userRepository.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(notificationRepository.findByDeduplicationKey(
                "property-approved-72"))
                .thenReturn(Optional.of(notification));

        notificationService.notifyUserOnce(
                owner.getId(),
                NotificationType.PROPERTY_APPROVED,
                NotificationPriority.HIGH,
                "Property approved",
                "Property Cottage (ID: 72) has been approved.",
                72L,
                "PROPERTY",
                "property-approved-72");

        verify(notificationRepository, org.mockito.Mockito.never())
                .insertIfDeduplicationKeyAbsent(
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any());
        verify(notificationSseService, org.mockito.Mockito.never())
                .sendNotification(any(), any(NotificationResponse.class));
    }

    @Test
    void concurrentRequestsForSameRecipientAndEventInsertAndDeliverOnlyOnce()
            throws Exception {
        String persistedKey = "12:property-approved-72";
        Set<String> persistedKeys = ConcurrentHashMap.newKeySet();
        AtomicInteger insertCount = new AtomicInteger();
        when(userRepository.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(notificationRepository.findByDeduplicationKey(
                "property-approved-72"))
                .thenReturn(Optional.empty());
        when(notificationRepository.insertIfDeduplicationKeyAbsent(
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any()))
                .thenAnswer(invocation -> {
                    String key = invocation.getArgument(7);
                    boolean inserted = persistedKeys.add(key);
                    if (inserted) {
                        insertCount.incrementAndGet();
                    }
                    return inserted ? 1 : 0;
                });
        when(notificationRepository.findByDeduplicationKey(persistedKey))
                .thenAnswer(invocation -> persistedKeys.contains(persistedKey)
                        ? Optional.of(notification)
                        : Optional.empty());

        var executor = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try {
            var first = executor.submit(() -> {
                notifyAfterStart(ready, start);
                return null;
            });
            var second = executor.submit(() -> {
                notifyAfterStart(ready, start);
                return null;
            });

            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            first.get(5, TimeUnit.SECONDS);
            second.get(5, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }

        assertEquals(1, insertCount.get());
        assertEquals(Set.of(persistedKey), persistedKeys);
        verify(notificationSseService, times(1)).sendNotification(
                org.mockito.ArgumentMatchers.eq(owner.getId()),
                any(NotificationResponse.class));
    }

    @Test
    void deduplicationIsScopedByRecipientAndEventKey() {
        User anotherOwner = new User();
        anotherOwner.setId(13L);
        when(userRepository.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(userRepository.findById(anotherOwner.getId()))
                .thenReturn(Optional.of(anotherOwner));
        when(notificationRepository.insertIfDeduplicationKeyAbsent(
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any()))
                .thenReturn(1);
        when(notificationRepository.findByDeduplicationKey(any()))
                .thenAnswer(invocation -> invocation.<String>getArgument(0).contains(":")
                        ? Optional.of(notification)
                        : Optional.empty());

        notifyOnce(owner.getId(), "property-approved-72");
        notifyOnce(anotherOwner.getId(), "property-approved-72");
        notifyOnce(owner.getId(), "property-approved-73");

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        verify(notificationRepository, times(3))
                .insertIfDeduplicationKeyAbsent(
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        keyCaptor.capture());
        assertEquals(
                List.of(
                        "12:property-approved-72",
                        "13:property-approved-72",
                        "12:property-approved-73"),
                keyCaptor.getAllValues());
        verify(notificationSseService, times(3))
                .sendNotification(any(), any(NotificationResponse.class));
    }

    @Test
    void loggedInUserCanFetchAndMarkTheirPersistentNotificationRead() {
        when(userRepository.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        when(notificationRepository.findByUser_IdAndReadFalseOrderByCreatedAtDesc(owner.getId()))
                .thenReturn(List.of(notification));
        when(notificationRepository.findById(31L)).thenReturn(Optional.of(notification));

        List<NotificationResponse> unread = notificationService.getMyUnreadNotifications();
        assertEquals(1, unread.size());
        assertFalse(unread.get(0).isRead());

        notificationService.markAsRead(31L);
        assertTrue(notification.isRead());
        verify(notificationRepository).save(notification);
    }

    @Test
    void userCannotMarkAnotherUsersNotificationRead() {
        User otherOwner = new User();
        otherOwner.setId(99L);
        notification.setUser(otherOwner);
        when(userRepository.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        when(notificationRepository.findById(31L)).thenReturn(Optional.of(notification));

        assertThrows(AccessDeniedException.class,
                () -> notificationService.markAsRead(31L));
    }

    private void notifyAfterStart(
            CountDownLatch ready,
            CountDownLatch start) throws InterruptedException {
        ready.countDown();
        if (!start.await(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Concurrent notification test did not start");
        }
        notifyOnce(owner.getId(), "property-approved-72");
    }

    private void notifyOnce(Long recipientId, String deduplicationKey) {
        notificationService.notifyUserOnce(
                recipientId,
                NotificationType.PROPERTY_APPROVED,
                NotificationPriority.HIGH,
                "Property approved",
                "Property Cottage (ID: 72) has been approved.",
                72L,
                "PROPERTY",
                deduplicationKey);
    }
}
