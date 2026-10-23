package com.rental.rental_management_backend.notification.service;

import com.rental.rental_management_backend.notification.entity.UserDeviceToken;

public interface PushProvider {

    int send(UserDeviceToken subscription, String payload);
}
